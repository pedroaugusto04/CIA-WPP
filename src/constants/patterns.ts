/** Identificadores e nomes de variáveis usados nos templates. */
export const IDENTIFIER_PATTERN = /^[\w-]+$/;
export const TEMPLATE_PLACEHOLDER_PATTERN = /\{\{([\w-]+)\}\}/g;

/** Formatos aceitos pela integração da Meta. */
export const GRAPH_VERSION_PATTERN = /^v\d+\.\d+$/;
export const DIGITS_ONLY_PATTERN = /^\d+$/;

/** Rotas de callback devem ser literais, sem query, fragmento ou parâmetros. */
export const UNSUPPORTED_ROUTE_CHARACTERS_PATTERN = /[?#:*]/;

/** Digest HMAC SHA-256 usado somente nos identificadores técnicos persistidos. */
export const HASHED_IDENTIFIER_PATTERN = /^[a-f0-9]{64}$/;
