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
from typing import Any, Optional
import httpx

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

    def close(self) -> None:
        """Release any held resources (httpx clients, etc.)."""
        pass

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} model={self.model}>"


# ─────────────────────────────────────────────────────────────────────────────
# Provider implementations
# ─────────────────────────────────────────────────────────────────────────────

class GroqProvider(BaseLLMProvider):
    """
    Groq — fastest inference, recommended default.
    Models: llama-3.3-70b-versatile, llama-3.1-8b-instant, meta-llama/llama-4-scout-17b-16e-instruct
    Env:    GROQ_API_KEY
    Docs:   https://console.groq.com/docs/models
    """
    DEFAULT_MODEL = "llama-3.3-70b-versatile"

    def __init__(self, model: str = DEFAULT_MODEL, api_key: Optional[str] = None, **kwargs) -> None:
        super().__init__(model)
        from langchain_openai import ChatOpenAI
        key = api_key or os.environ.get("GROQ_API_KEY")
        if not key:
            raise ValueError("GROQ_API_KEY is not set. Provide it via environment variable or api_key parameter.")
        self._client = ChatOpenAI(
            model=model,
            temperature=0,
            api_key=key,
            base_url="https://api.groq.com/openai/v1",
            http_client=httpx.Client(),
            http_async_client=httpx.AsyncClient(),
            **kwargs,
        )

    def invoke(self, prompt: str) -> LLMResponse:
        raw = self._client.invoke(prompt)
        return LLMResponse(content=raw.content, raw=raw)

    def close(self) -> None:
        try:
            self._client.http_client.close()
            self._client.http_async_client.aclose()
        except Exception:
            pass


class OpenAIProvider(BaseLLMProvider):
    """
    OpenAI — GPT-5.4 series is the current flagship.
    Models: gpt-4o, gpt-4o-mini, gpt-4-turbo (check API for latest available)
    Env:    OPENAI_API_KEY
    Docs:   https://platform.openai.com/docs/models
    Pkg:    pip install langchain-openai
    """
    DEFAULT_MODEL = "gpt-4o"

    def __init__(self, model: str = DEFAULT_MODEL, api_key: Optional[str] = None, **kwargs) -> None:
        super().__init__(model)
        from langchain_openai import ChatOpenAI
        key = api_key or os.environ.get("OPENAI_API_KEY")
        if not key:
            raise ValueError("OPENAI_API_KEY is not set. Provide it via environment variable or api_key parameter.")
        self._client = ChatOpenAI(
            model=model,
            temperature=0,
            api_key=key,
            http_client=httpx.Client(),
            http_async_client=httpx.AsyncClient(),
            **kwargs,
        )

    def invoke(self, prompt: str) -> LLMResponse:
        raw = self._client.invoke(prompt)
        return LLMResponse(content=raw.content, raw=raw)

    def close(self) -> None:
        try:
            self._client.http_client.close()
            self._client.http_async_client.aclose()
        except Exception:
            pass


class AnthropicProvider(BaseLLMProvider):
    """
    Anthropic Claude — claude-sonnet-4-6 is the current balanced flagship.
    Models: claude-sonnet-4-6, claude-opus-4-8, claude-haiku-4-5-20251001
    Env:    ANTHROPIC_API_KEY
    Docs:   https://docs.anthropic.com/en/docs/about-claude/models
    Pkg:    pip install langchain-anthropic
    """
    DEFAULT_MODEL = "claude-sonnet-4-6"

    def __init__(self, model: str = DEFAULT_MODEL, api_key: Optional[str] = None, **kwargs) -> None:
        super().__init__(model)
        from langchain_anthropic import ChatAnthropic
        key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        if not key:
            raise ValueError("ANTHROPIC_API_KEY is not set. Provide it via environment variable or api_key parameter.")
        self._client = ChatAnthropic(
            model=model,
            temperature=0,
            api_key=key,
            **kwargs,
        )

    def invoke(self, prompt: str) -> LLMResponse:
        raw = self._client.invoke(prompt)
        return LLMResponse(content=raw.content, raw=raw)


class GeminiProvider(BaseLLMProvider):
    """
    Google Gemini — Gemini 3.x series is the current generation (2.0/2.5 deprecated).
    Models: gemini-3.1-pro, gemini-3.1-flash, gemini-3.5-flash
    Env:    GEMINI_API_KEY
    Docs:   https://ai.google.dev/gemini-api/docs/models
    Pkg:    pip install langchain-google-genai
    """
    DEFAULT_MODEL = "gemini-3.1-flash"

    def __init__(self, model: str = DEFAULT_MODEL, api_key: Optional[str] = None, **kwargs) -> None:
        super().__init__(model)
        from langchain_google_genai import ChatGoogleGenerativeAI
        key = api_key or os.environ.get("GEMINI_API_KEY")
        if not key:
            raise ValueError("GEMINI_API_KEY is not set. Provide it via environment variable or api_key parameter.")
        self._client = ChatGoogleGenerativeAI(
            model=model,
            temperature=0,
            google_api_key=key,
            **kwargs,
        )

    def invoke(self, prompt: str) -> LLMResponse:
        raw = self._client.invoke(prompt)
        return LLMResponse(content=raw.content, raw=raw)


class DeepSeekProvider(BaseLLMProvider):
    """
    DeepSeek — excellent at code, SQL, and reasoning tasks.
    Models: deepseek-v4-flash, deepseek-v4-pro, deepseek-r1
    Note:   deepseek-chat alias still works (maps to deepseek-v4-flash non-thinking mode)
    Env:    DEEPSEEK_API_KEY
    Docs:   https://api-docs.deepseek.com
    Pkg:    pip install openai  (DeepSeek uses OpenAI-compatible API)
    """
    DEFAULT_MODEL = "deepseek-v4-flash"
    BASE_URL = "https://api.deepseek.com/v1"

    def __init__(self, model: str = DEFAULT_MODEL, api_key: Optional[str] = None, **kwargs) -> None:
        super().__init__(model)
        from langchain_openai import ChatOpenAI
        key = api_key or os.environ.get("DEEPSEEK_API_KEY")
        if not key:
            raise ValueError("DEEPSEEK_API_KEY is not set. Provide it via environment variable or api_key parameter.")
        self._client = ChatOpenAI(
            model=model,
            temperature=0,
            api_key=key,
            base_url=self.BASE_URL,
            http_client=httpx.Client(),
            http_async_client=httpx.AsyncClient(),
            **kwargs,
        )

    def invoke(self, prompt: str) -> LLMResponse:
        raw = self._client.invoke(prompt)
        return LLMResponse(content=raw.content, raw=raw)

    def close(self) -> None:
        try:
            self._client.http_client.close()
            self._client.http_async_client.aclose()
        except Exception:
            pass


class HuggingFaceProvider(BaseLLMProvider):
    """
    HuggingFace Inference API — access any public or private HF model.
    Models: mistralai/Mistral-Large-3, mistralai/Mistral-Small-4, Qwen/Qwen3.6-27B
    Env:    HF_API_KEY
    Docs:   https://huggingface.co/docs/api-inference
    Pkg:    pip install huggingface_hub
    """
    DEFAULT_MODEL = "mistralai/Mistral-Small-4"

    def __init__(self, model: str = DEFAULT_MODEL, api_key: Optional[str] = None, **kwargs) -> None:
        super().__init__(model)
        from huggingface_hub import InferenceClient
        key = api_key or os.environ.get("HF_API_KEY")
        if not key:
            raise ValueError("HF_API_KEY is not set. Provide it via environment variable or api_key parameter.")
        self._client = InferenceClient(
            model=model,
            token=key,
        )

    def invoke(self, prompt: str) -> LLMResponse:
        raw = self._client.text_generation(
            prompt,
            max_new_tokens=1024,
            temperature=0.01,
        )
        content = raw if isinstance(raw, str) else str(raw)
        return LLMResponse(content=content, raw=raw)


class QwenProvider(BaseLLMProvider):
    """
    Alibaba Qwen — strong multilingual, coding, and reasoning capability.
    Models: qwen3.7-max, qwen3.7-plus, qwen3.6-plus, qwq-32b (reasoning)
    Env:    DASHSCOPE_API_KEY
    Docs:   https://modelstudio.console.alibabacloud.com/
    Pkg:    pip install dashscope
    Note:   Uses OpenAI-compatible endpoint via DashScope
    """
    DEFAULT_MODEL = "qwen3.7-plus"
    BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"

    def __init__(self, model: str = DEFAULT_MODEL, api_key: Optional[str] = None, **kwargs) -> None:
        super().__init__(model)
        from langchain_openai import ChatOpenAI
        key = api_key or os.environ.get("DASHSCOPE_API_KEY")
        if not key:
            raise ValueError("DASHSCOPE_API_KEY is not set. Provide it via environment variable or api_key parameter.")
        self._client = ChatOpenAI(
            model=model,
            temperature=0,
            api_key=key,
            base_url=self.BASE_URL,
            http_client=httpx.Client(),
            http_async_client=httpx.AsyncClient(),
            **kwargs,
        )

    def invoke(self, prompt: str) -> LLMResponse:
        raw = self._client.invoke(prompt)
        return LLMResponse(content=raw.content, raw=raw)

    def close(self) -> None:
        try:
            self._client.http_client.close()
            self._client.http_async_client.aclose()
        except Exception:
            pass


class OllamaProvider(BaseLLMProvider):
    """
    Ollama — run any model locally, zero cost, zero data leaving your machine.
    Models: llama3.3, mistral-small, qwen3, phi4, gemma3, deepseek-r1 (whatever you've pulled)
    Env:    OLLAMA_BASE_URL (default: http://localhost:11434)
    Pkg:    pip install langchain-ollama
    Setup:  brew install ollama && ollama pull llama3.3
    """
    DEFAULT_MODEL = "llama3.3"

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

# Track the current instance so we can close it before replacing
_current_llm: Optional[BaseLLMProvider] = None


def get_llm(refresh: bool = False) -> BaseLLMProvider:
    """
    Return the configured LLM provider instance.
    Cached — only instantiated once per process unless refresh=True.

    Reads from memory configuration first, then from environment:
        ARIVU_LLM_PROVIDER  (default: groq)
        ARIVU_LLM_MODEL     (default: provider's default model)

    Pass refresh=True to reload the provider (e.g. after changing config).
    """
    global _current_llm

    if _current_llm is not None and not refresh:
        return _current_llm

    if _current_llm is not None and refresh:
        try:
            _current_llm.close()
        except Exception:
            pass
        _current_llm = None

    from ..memory.store import get_llm_config
    config = get_llm_config()

    if config:
        provider_name = config.get("provider", "groq").lower().strip()
        model = config.get("model", "").strip()
        api_key = config.get("api_key", "").strip() or None
    else:
        provider_name = os.environ.get("ARIVU_LLM_PROVIDER", "groq").lower().strip()
        model = os.environ.get("ARIVU_LLM_MODEL", "").strip()
        api_key = None

    if provider_name not in PROVIDER_REGISTRY:
        raise ValueError(
            f"Unknown LLM provider '{provider_name}'. "
            f"Choose from: {', '.join(sorted(PROVIDER_REGISTRY))}"
        )

    provider_cls = PROVIDER_REGISTRY[provider_name]

    if not model:
        model = DEFAULT_MODELS[provider_name]

    logger.info(f"LLM provider: {provider_name}  model: {model}")

    _current_llm = provider_cls(model=model, api_key=api_key)
    return _current_llm


def list_providers() -> dict[str, str]:
    """Return all supported providers and their default models."""
    return {name: DEFAULT_MODELS[name] for name in sorted(PROVIDER_REGISTRY)}
