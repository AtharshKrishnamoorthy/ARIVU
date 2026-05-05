"""
arivu.llm
────────────────
Multi-provider LLM abstraction layer.

    from arivu.llm import get_llm, list_providers

    llm = get_llm()
    response = llm.invoke("SELECT ...")
    print(response.content)
"""

from .providers import (
    get_llm,
    list_providers,
    BaseLLMProvider,
    LLMResponse,
    PROVIDER_REGISTRY,
    # Individual providers — for direct use if needed
    GroqProvider,
    OpenAIProvider,
    AnthropicProvider,
    GeminiProvider,
    DeepSeekProvider,
    HuggingFaceProvider,
    QwenProvider,
    OllamaProvider,
)

__all__ = [
    "get_llm",
    "list_providers",
    "BaseLLMProvider",
    "LLMResponse",
    "PROVIDER_REGISTRY",
    "GroqProvider",
    "OpenAIProvider",
    "AnthropicProvider",
    "GeminiProvider",
    "DeepSeekProvider",
    "HuggingFaceProvider",
    "QwenProvider",
    "OllamaProvider",
]