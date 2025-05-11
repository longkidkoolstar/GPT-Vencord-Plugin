/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

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

export async function generateResponse(
    _: any,
    apiKey: string,
    model: string,
    messages: Message[],
    systemPrompt: string
): Promise<OpenRouterResponse> {
    try {
        // Add system message if provided
        const allMessages = [];
        
        if (systemPrompt) {
            allMessages.push({
                role: "system",
                content: systemPrompt
            });
        }
        
        // Add conversation messages
        allMessages.push(...messages);
        
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "https://vencord.dev/",
                "X-Title": "Vencord GPT Plugin"
            },
            body: JSON.stringify({
                model: model,
                messages: allMessages,
                temperature: 0.7,
                max_tokens: 1024,
                stream: false
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
        }
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error("Error in generateResponse:", error);
        throw error;
    }
}

export async function estimateTokens(
    _: any,
    messages: Message[]
): Promise<number> {
    // Simple token estimation (roughly 4 chars per token)
    try {
        let totalChars = 0;
        
        for (const message of messages) {
            totalChars += message.content.length;
        }
        
        return Math.ceil(totalChars / 4);
    } catch (error) {
        console.error("Error estimating tokens:", error);
        return 0;
    }
}

export async function formatDebugInfo(
    _: any,
    response: OpenRouterResponse
): Promise<string> {
    try {
        const { model, usage } = response;
        
        // Calculate approximate cost (these are estimates for free models)
        const promptCost = (usage.prompt_tokens / 1000) * 0.0001;
        const completionCost = (usage.completion_tokens / 1000) * 0.0002;
        const totalCost = promptCost + completionCost;
        
        return `**Debug Info:**
- Model: ${model}
- Prompt Tokens: ${usage.prompt_tokens}
- Completion Tokens: ${usage.completion_tokens}
- Total Tokens: ${usage.total_tokens}
- Estimated Cost: $${totalCost.toFixed(6)} (Free)`;
    } catch (error) {
        console.error("Error formatting debug info:", error);
        return "Error generating debug info";
    }
}
