"""
arivu.llm.providers
──────────────────────────
Multi-provider LLM abstraction.

Every pipeline node calls _get_llm() and gets back a provider instance.
The provider exposes a single .invoke(prompt) method regardless of which
backend is underneath.

Supported providers:
    groq        — Groq (llama3, mixtral, gemma)         [default, fastest]
    openai      — OpenAI (gpt-4o, gpt-4-turbo, gpt-3.5)
    anthropic   — Anthropic (claude-3-5-sonnet, claude-3-haiku)
    gemini      — Google Gemini (gemini-1.5-pro, gemini-flash)
    deepseek    — DeepSeek (deepseek-chat, deepseek-coder)
    huggingface — HuggingFace Inference API (any HF model)
    qwen        — Alibaba Qwen (via DashScope API)
    ollama      — Local Ollama (any locally pulled model, zero cost)

Configuration — set in .env or environment:
    ARIVU_LLM_PROVIDER=groq          # which provider to use
    ARIVU_LLM_MODEL=llama3-70b-8192  # which model on that provider

    # Then the matching API key for your chosen provider:
    GROQ_API_KEY=...
    OPENAI_API_KEY=...
    ANTHROPIC_API_KEY=...
    GEMINI_API_KEY=...
    DEEPSEEK_API_KEY=...
    HF_API_KEY=...
    DASHSCOPE_API_KEY=...
    # Ollama needs no key — just a running local server

Usage (inside pipeline nodes — unchanged):
    from arivu.llm import get_llm
    llm = get_llm()
    response = llm.invoke("your prompt here")
    text = response.content
"""

from __future__ import annotations

import logging
import os
from abc import ABC, abstractmethod
from functools import lru_cache
from typing import Any

logger = logging.getLogger("arivu.llm")


# ─────────────────────────────────────────────────────────────────────────────
# Response wrapper — normalises all provider outputs to the same shape
# ─────────────────────────────────────────────────────────────────────────────

class LLMResponse:
    """
    Unified response object returned by every provider.
    Always has .content (str) regardless of underlying SDK.
    """
    def __init__(self, content: str, raw: Any = None) -> None:
        self.content = content
        self.raw = raw           # original SDK response, for advanced use

    def __repr__(self) -> str:
        return f"<LLMResponse content='{self.content[:60]}...'>"


# ─────────────────────────────────────────────────────────────────────────────
# Base provider interface
# ─────────────────────────────────────────────────────────────────────────────

class BaseLLMProvider(ABC):

    def __init__(self, model: str) -> None:
        self.model = model

    @abstractmethod
    def invoke(self, prompt: str) -> LLMResponse:
        """Send a prompt and return a normalised LLMResponse."""

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} model={self.model}>"


# ─────────────────────────────────────────────────────────────────────────────
# Provider implementations
# ─────────────────────────────────────────────────────────────────────────────

class GroqProvider(BaseLLMProvider):
    """
    Groq — fastest inference, recommended default.
    Models: llama3-70b-8192, llama3-8b-8192, mixtral-8x7b-32768, gemma-7b-it
    Env:    GROQ_API_KEY
    """
    DEFAULT_MODEL = "llama3-70b-8192"

    def __init__(self, model: str = DEFAULT_MODEL, **kwargs) -> None:
        super().__init__(model)
        # Bypass langchain-groq due to 'proxies' kwarg incompatibility with pip environments
        from langchain_openai import ChatOpenAI
        self._client = ChatOpenAI(
            model=model,
            temperature=0,
            api_key=os.environ["GROQ_API_KEY"],
            base_url="https://api.groq.com/openai/v1",
            **kwargs,
        )

    def invoke(self, prompt: str) -> LLMResponse:
        raw = self._client.invoke(prompt)
        return LLMResponse(content=raw.content, raw=raw)


class OpenAIProvider(BaseLLMProvider):
    """
    OpenAI — GPT-4o, GPT-4-turbo, GPT-3.5-turbo.
    Models: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo
    Env:    OPENAI_API_KEY
    Pkg:    pip install langchain-openai
    """
    DEFAULT_MODEL = "gpt-4o-mini"

    def __init__(self, model: str = DEFAULT_MODEL, **kwargs) -> None:
        super().__init__(model)
        from langchain_openai import ChatOpenAI
        self._client = ChatOpenAI(
            model=model,
            temperature=0,
            api_key=os.environ["OPENAI_API_KEY"],
            **kwargs,
        )

    def invoke(self, prompt: str) -> LLMResponse:
        raw = self._client.invoke(prompt)
        return LLMResponse(content=raw.content, raw=raw)


class AnthropicProvider(BaseLLMProvider):
    """
    Anthropic Claude — claude-3-5-sonnet is best for SQL reasoning.
    Models: claude-3-5-sonnet-20241022, claude-3-haiku-20240307, claude-3-opus-20240229
    Env:    ANTHROPIC_API_KEY
    Pkg:    pip install langchain-anthropic
    """
    DEFAULT_MODEL = "claude-3-5-sonnet-20241022"

    def __init__(self, model: str = DEFAULT_MODEL, **kwargs) -> None:
        super().__init__(model)
        from langchain_anthropic import ChatAnthropic
        self._client = ChatAnthropic(
            model=model,
            temperature=0,
            api_key=os.environ["ANTHROPIC_API_KEY"],
            **kwargs,
        )

    def invoke(self, prompt: str) -> LLMResponse:
        raw = self._client.invoke(prompt)
        return LLMResponse(content=raw.content, raw=raw)


class GeminiProvider(BaseLLMProvider):
    """
    Google Gemini — gemini-1.5-pro has very long context, good for big schemas.
    Models: gemini-1.5-pro, gemini-1.5-flash, gemini-pro
    Env:    GEMINI_API_KEY
    Pkg:    pip install langchain-google-genai
    """
    DEFAULT_MODEL = "gemini-1.5-flash"

    def __init__(self, model: str = DEFAULT_MODEL, **kwargs) -> None:
        super().__init__(model)
        from langchain_google_genai import ChatGoogleGenerativeAI
        self._client = ChatGoogleGenerativeAI(
            model=model,
            temperature=0,
            google_api_key=os.environ["GEMINI_API_KEY"],
            **kwargs,
        )

    def invoke(self, prompt: str) -> LLMResponse:
        raw = self._client.invoke(prompt)
        return LLMResponse(content=raw.content, raw=raw)


class DeepSeekProvider(BaseLLMProvider):
    """
    DeepSeek — excellent at code and SQL, very cost-effective.
    Models: deepseek-chat, deepseek-coder
    Env:    DEEPSEEK_API_KEY
    Pkg:    pip install openai  (DeepSeek uses OpenAI-compatible API)
    """
    DEFAULT_MODEL = "deepseek-chat"
    BASE_URL = "https://api.deepseek.com/v1"

    def __init__(self, model: str = DEFAULT_MODEL, **kwargs) -> None:
        super().__init__(model)
        from langchain_openai import ChatOpenAI
        self._client = ChatOpenAI(
            model=model,
            temperature=0,
            api_key=os.environ["DEEPSEEK_API_KEY"],
            base_url=self.BASE_URL,
            **kwargs,
        )

    def invoke(self, prompt: str) -> LLMResponse:
        raw = self._client.invoke(prompt)
        return LLMResponse(content=raw.content, raw=raw)


class HuggingFaceProvider(BaseLLMProvider):
    """
    HuggingFace Inference API — access any public or private HF model.
    Models: any model ID on HuggingFace hub e.g. mistralai/Mistral-7B-Instruct-v0.2
    Env:    HF_API_KEY
    Pkg:    pip install huggingface_hub
    """
    DEFAULT_MODEL = "mistralai/Mistral-7B-Instruct-v0.2"

    def __init__(self, model: str = DEFAULT_MODEL, **kwargs) -> None:
        super().__init__(model)
        from huggingface_hub import InferenceClient
        self._client = InferenceClient(
            model=model,
            token=os.environ["HF_API_KEY"],
        )

    def invoke(self, prompt: str) -> LLMResponse:
        raw = self._client.text_generation(
            prompt,
            max_new_tokens=1024,
            temperature=0.01,
        )
        # HF returns raw string for text-generation
        content = raw if isinstance(raw, str) else str(raw)
        return LLMResponse(content=content, raw=raw)


class QwenProvider(BaseLLMProvider):
    """
    Alibaba Qwen — strong multilingual + code capability.
    Models: qwen-turbo, qwen-plus, qwen-max, qwen-long
    Env:    DASHSCOPE_API_KEY
    Pkg:    pip install dashscope
    Note:   Uses OpenAI-compatible endpoint via DashScope
    """
    DEFAULT_MODEL = "qwen-turbo"
    BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"

    def __init__(self, model: str = DEFAULT_MODEL, **kwargs) -> None:
        super().__init__(model)
        from langchain_openai import ChatOpenAI
        self._client = ChatOpenAI(
            model=model,
            temperature=0,
            api_key=os.environ["DASHSCOPE_API_KEY"],
            base_url=self.BASE_URL,
            **kwargs,
        )

    def invoke(self, prompt: str) -> LLMResponse:
        raw = self._client.invoke(prompt)
        return LLMResponse(content=raw.content, raw=raw)


class OllamaProvider(BaseLLMProvider):
    """
    Ollama — run any model locally, zero cost, zero data leaving your machine.
    Models: llama3, mistral, codellama, phi3, gemma, qwen2 (whatever you've pulled)
    Env:    OLLAMA_BASE_URL (default: http://localhost:11434)
    Pkg:    pip install langchain-ollama
    Setup:  brew install ollama && ollama pull llama3
    """
    DEFAULT_MODEL = "llama3"

    def __init__(self, model: str = DEFAULT_MODEL, **kwargs) -> None:
        super().__init__(model)
        from langchain_ollama import ChatOllama
        self._client = ChatOllama(
            model=model,
            temperature=0,
            base_url=os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434"),
            **kwargs,
        )

    def invoke(self, prompt: str) -> LLMResponse:
        raw = self._client.invoke(prompt)
        return LLMResponse(content=raw.content, raw=raw)


# ─────────────────────────────────────────────────────────────────────────────
# Provider registry + factory
# ─────────────────────────────────────────────────────────────────────────────

PROVIDER_REGISTRY: dict[str, type[BaseLLMProvider]] = {
    "groq":         GroqProvider,
    "openai":       OpenAIProvider,
    "anthropic":    AnthropicProvider,
    "gemini":       GeminiProvider,
    "deepseek":     DeepSeekProvider,
    "huggingface":  HuggingFaceProvider,
    "qwen":         QwenProvider,
    "ollama":       OllamaProvider,
}

# Human-readable default models per provider (shown in logs + errors)
DEFAULT_MODELS: dict[str, str] = {
    "groq":         GroqProvider.DEFAULT_MODEL,
    "openai":       OpenAIProvider.DEFAULT_MODEL,
    "anthropic":    AnthropicProvider.DEFAULT_MODEL,
    "gemini":       GeminiProvider.DEFAULT_MODEL,
    "deepseek":     DeepSeekProvider.DEFAULT_MODEL,
    "huggingface":  HuggingFaceProvider.DEFAULT_MODEL,
    "qwen":         QwenProvider.DEFAULT_MODEL,
    "ollama":       OllamaProvider.DEFAULT_MODEL,
}


@lru_cache(maxsize=1)
def get_llm() -> BaseLLMProvider:
    """
    Return the configured LLM provider instance.
    Cached — only instantiated once per process.

    Reads from memory configuration first, then from environment:
        ARIVU_LLM_PROVIDER  (default: groq)
        ARIVU_LLM_MODEL     (default: provider's default model)
    """
    from ..memory.store import get_llm_config
    config = get_llm_config()

    if config:
        provider_name = config.get("provider", "groq").lower().strip()
        model = config.get("model", "").strip()
        api_key = config.get("api_key", "").strip()
        if api_key:
            env_map = {
                "groq": "GROQ_API_KEY",
                "openai": "OPENAI_API_KEY",
                "anthropic": "ANTHROPIC_API_KEY",
                "gemini": "GEMINI_API_KEY",
                "deepseek": "DEEPSEEK_API_KEY",
                "huggingface": "HF_API_KEY",
                "qwen": "DASHSCOPE_API_KEY"
            }
            if provider_name in env_map:
                os.environ[env_map[provider_name]] = api_key
    else:
        provider_name = os.environ.get("ARIVU_LLM_PROVIDER", "groq").lower().strip()
        model = os.environ.get("ARIVU_LLM_MODEL", "").strip()

    if provider_name not in PROVIDER_REGISTRY:
        raise ValueError(
            f"Unknown LLM provider '{provider_name}'. "
            f"Choose from: {', '.join(sorted(PROVIDER_REGISTRY))}"
        )

    provider_cls = PROVIDER_REGISTRY[provider_name]

    if not model:
        model = DEFAULT_MODELS[provider_name]

    logger.info(f"LLM provider: {provider_name}  model: {model}")

    return provider_cls(model=model)


def list_providers() -> dict[str, str]:
    """Return all supported providers and their default models."""
    return {name: DEFAULT_MODELS[name] for name in sorted(PROVIDER_REGISTRY)}