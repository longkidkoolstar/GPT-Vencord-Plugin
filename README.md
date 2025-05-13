# GPT-Vencord Plugin

A Vencord plugin that integrates with the OpenRouter API to allow GPT-based models to respond on behalf of you in Discord chats.

## Features

- **AI-Powered Responses**: Generate contextual responses using free AI models from OpenRouter
- **Slash Command**: Use `/respond` to generate a response based on the current chat context
- **Chat Button**: Click the AI button next to messages to generate a response
- **Customizable Settings**:
  - Context Length: Control how much chat history is included
  - Model Selection: Choose from free AI models
  - Chat Scope: Configure where the AI can respond (DMs, channels, or both)
  - Custom Instructions: Set the AI's tone, style, and behavior
  - Output Mode: Choose how responses are displayed
- **Debug Options**:
  - View API requests and responses
  - See token counts and cost estimates
  - Detailed error logging

## Setup

1. Get a free API key from [OpenRouter](https://openrouter.ai)
2. Enter your API key in the plugin settings
3. Configure your preferences in the settings panel
4. Start using the `/respond` command or chat buttons

## Usage

### Slash Command

Type `/respond` in any chat to generate an AI response based on the current conversation context.

### Chat Button

Click the AI button next to messages to generate a contextual response.

### Settings

- **Context Length**: Adjust how many previous messages are included in the prompt
- **Model**: Select which free AI model to use
- **Chat Scope**: Choose where the AI can respond
- **System Instructions**: Customize how the AI responds (tone, style, etc.)
- **Output Mode**: Select how responses are displayed
- **Debug Options**: Enable/disable debugging features

## Models

This plugin only uses free models from OpenRouter:

- Google Gemini 2.0 Flash
- Reka Flash 3

## Privacy & Security

- Your API key is stored locally and only sent to OpenRouter
- Chat context is only sent to the AI when you explicitly request a response
- No data is stored or logged by the plugin beyond what's needed for functionality

## Troubleshooting

If you encounter issues:

1. Check that your OpenRouter API key is valid
2. Ensure you have sufficient credits on your OpenRouter account
3. Check the console for error messages if you have error logging enabled
4. Try a different model if one isn't working properly

## Credits

- OpenRouter for providing access to free AI models
- Vencord for the plugin framework
