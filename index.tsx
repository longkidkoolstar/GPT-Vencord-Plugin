/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, sendBotMessage } from "@api/Commands";
import { definePluginSettings } from "@api/Settings";
import { Flex } from "@components/Flex";
import { Devs } from "@utils/constants";
import { insertTextIntoChatInputBox, sendMessage } from "@utils/discord";
import { Margins } from "@utils/margins";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { Button, Forms, MessageStore, React, SelectedChannelStore, showToast, Switch, TextInput, Toasts, useEffect, useState } from "@webpack/common";

// Import native functions directly
import { estimateTokens, formatDebugInfo, generateResponse } from "./native";

// Import types from native.ts
interface Message {
    content: string;
    author: {
        username: string;
        bot?: boolean;
    };
    role: "user" | "assistant" | "system";
}

interface OpenRouterResponse {
    id: string;
    choices: {
        message: {
            content: string;
            role: string;
        };
        finish_reason: string;
        index: number;
    }[];
    model: string;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

// Define settings for the plugin
const settings = definePluginSettings({
    contextLength: {
        type: OptionType.SLIDER,
        markers: [5, 10, 20, 30, 50, 100],
        default: 20,
        description: "Number of previous messages to include as context",
    },
    model: {
        type: OptionType.SELECT,
        options: [
            { label: "Google Gemini Flash 1.5 8B", value: "google/gemini-flash-1.5-8b-exp", default: true },
            { label: "Google Gemini 2.0 Flash", value: "google/gemini-2.0-flash-exp:free" },
            { label: "Reka Flash 3", value: "rekaai/reka-flash-3:free" },
        ],
        description: "Select the AI model to use (free models only)",
    },
    chatScope: {
        type: OptionType.SELECT,
        options: [
            { label: "Private DMs Only", value: "dms" },
            { label: "Public Channels Only", value: "channels" },
            { label: "Both DMs and Channels", value: "both", default: true },
        ],
        description: "Where the AI can respond",
    },
    systemInstructions: {
        type: OptionType.STRING,
        default: "You are acting as me in this conversation. Respond in my tone and voice, not as an AI assistant. Be concise and natural.",
        description: "System instructions for the AI (tone, style, role, etc.)",
    },
    outputMode: {
        type: OptionType.SELECT,
        options: [
            { label: "Ephemeral (only you see it)", value: "ephemeral", default: true },
            { label: "Type into message bar", value: "typebar" },
        ],
        description: "How /respond command outputs the AI response",
    },
    showDebugInfo: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Show debug information (API requests/responses)",
    },
    showTokenCount: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show token count and cost estimate",
    },
    logErrors: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Log errors to console with helpful messages",
    },
    apiKey: {
        type: OptionType.STRING,
        default: "",
        description: "OpenRouter API Key",
    },
    customSettings: {
        type: OptionType.COMPONENT,
        component: SettingsComponent,
        description: "Configure GPT settings",
    },
});

function SettingsComponent(props: { setValue(v: any): void; }) {
    const [apiKey, setApiKey] = useState(settings.store.apiKey || "");

    const updateApiKey = (newValue: string) => {
        setApiKey(newValue);
        settings.store.apiKey = newValue;
    };

    return (
        <Flex flexDirection="column">
            <Forms.FormSection title="OpenRouter API Key">
                <Forms.FormText type={Forms.FormText.Types.DESCRIPTION}>
                    Enter your OpenRouter API key. You can get one for free at <a href="https://openrouter.ai" target="_blank" rel="noreferrer">openrouter.ai</a>
                </Forms.FormText>
                <TextInput
                    type="password"
                    value={apiKey}
                    placeholder="or-..."
                    onChange={updateApiKey}
                    className={Margins.top16}
                />
            </Forms.FormSection>

            <Forms.FormDivider />
            <Forms.FormSection title="Debug Options">
                <Switch
                    value={settings.store.showDebugInfo}
                    onChange={(v: boolean) => { settings.store.showDebugInfo = v; }}
                    note="Show API request and response data"
                >
                    Show Debug Info
                </Switch>
                <Switch
                    value={settings.store.showTokenCount}
                    onChange={(v: boolean) => { settings.store.showTokenCount = v; }}
                    note="Show token count and cost estimate"
                >
                    Show Token Count
                </Switch>
                <Switch
                    value={settings.store.logErrors}
                    onChange={(v: boolean) => { settings.store.logErrors = v; }}
                    note="Log detailed errors to console"
                >
                    Log Errors
                </Switch>
            </Forms.FormSection>
        </Flex>
    );
}

// Helper function to get chat context
async function getChatContext(channelId: string, contextLength: number): Promise<Message[]> {
    try {
        // Get recent messages from the channel
        const messages = MessageStore.getMessages(channelId)?.toArray() || [];

        // Take only the last N messages based on contextLength setting
        const contextMessages = messages.slice(-contextLength);

        // Format messages for the API
        return contextMessages.map(msg => ({
            content: msg.content,
            author: {
                username: msg.author.username,
                bot: msg.author.bot
            },
            role: "user" // All messages are treated as user messages for context
        }));
    } catch (error) {
        console.error("Error getting chat context:", error);
        return [];
    }
}

// Function to handle AI response generation
async function generateAIResponse(channelId: string) {
    try {
        if (!settings.store.apiKey) {
            showToast("Please set your OpenRouter API key in the plugin settings", { type: Toasts.Type.FAILURE });
            return null;
        }

        // Get chat context
        const context = await getChatContext(channelId, settings.store.contextLength);

        if (context.length === 0) {
            showToast("No messages found to generate context", { type: Toasts.Type.FAILURE });
            return null;
        }

        // Show loading toast
        showToast("Generating AI response...", { type: Toasts.Type.INFO });

        // Call the API
        const response = await generateResponse(
            null,
            settings.store.apiKey,
            settings.store.model,
            context,
            settings.store.systemInstructions
        );

        if (!response || !response.choices || response.choices.length === 0) {
            showToast("Failed to generate response", { type: Toasts.Type.FAILURE });
            return null;
        }

        // Get the generated text
        const generatedText = response.choices[0].message.content;

        // Show debug info if enabled
        if (settings.store.showDebugInfo || settings.store.showTokenCount) {
            const debugInfo = await formatDebugInfo(null, response);
            console.log(debugInfo);

            if (settings.store.showTokenCount) {
                showToast(`Generated response (${response.usage.total_tokens} tokens)`, { type: Toasts.Type.SUCCESS });
            }
        }

        return { text: generatedText, response };
    } catch (error) {
        if (settings.store.logErrors) {
            console.error("Error generating AI response:", error);
        }
        showToast("Error generating AI response", { type: Toasts.Type.FAILURE });
        return null;
    }
}



export default definePlugin({
    name: "GPT-Vencord",
    description: "Integrate with OpenRouter API to allow GPT-based models to respond on behalf of you in Discord chats",
    authors: [{ name: "Aria", id: 0n }],
    settings,
    dependencies: ["CommandsAPI"],

    commands: [
        {
            name: "respond",
            description: "Generate a response using AI",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [],
            execute: async (_, ctx) => {
                try {
                    // Check if the channel type matches the user's settings
                    const isGuildChannel = Boolean(ctx.channel.guild_id);
                    const chatScope = settings.store.chatScope;

                    if ((isGuildChannel && chatScope === "dms") || (!isGuildChannel && chatScope === "channels")) {
                        sendBotMessage(ctx.channel.id, {
                            content: "AI responses are not enabled for this type of channel. Check your plugin settings."
                        });
                        return;
                    }

                    const result = await generateAIResponse(ctx.channel.id);

                    if (result) {
                        if (settings.store.outputMode === "ephemeral") {
                            sendBotMessage(ctx.channel.id, {
                                content: result.text + (settings.store.showDebugInfo ?
                                    `\n\n${await formatDebugInfo(null, result.response)}` : "")
                            });
                        } else {
                            insertTextIntoChatInputBox(result.text);
                        }
                    }
                } catch (error) {
                    if (settings.store.logErrors) {
                        console.error("Error in /respond command:", error);
                    }
                    sendBotMessage(ctx.channel.id, { content: "Error generating AI response. Check console for details." });
                }
            }
        }
    ],

    // Add a button to message popovers
    renderMessagePopoverButton(message, channel) {
        // Check if the channel type matches the user's settings
        const isGuildChannel = Boolean(channel.guild_id);
        const chatScope = settings.store.chatScope;

        if ((isGuildChannel && chatScope === "dms") || (!isGuildChannel && chatScope === "channels")) {
            return null; // Don't show button in disabled channels
        }

        return {
            label: "AI Response",
            icon: "robot", // Using a standard icon name
            message,
            channel,
            onClick: async () => {
                const result = await generateAIResponse(channel.id);

                if (result) {
                    if (settings.store.outputMode === "ephemeral") {
                        sendBotMessage(channel.id, {
                            content: result.text + (settings.store.showDebugInfo ?
                                `\n\n${await formatDebugInfo(null, result.response)}` : "")
                        });
                    } else {
                        insertTextIntoChatInputBox(result.text);
                    }
                }
            }
        };
    },

    start() {
        // Plugin initialization code
    },

    stop() {
        // Cleanup code
    }
});
