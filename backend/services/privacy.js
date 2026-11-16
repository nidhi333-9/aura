const HIDDEN = "[hidden]";

const MAX_INPUT_LENGTH = 2000;

const TOKEN_LIKE =
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;

const SECRET_PARAMETER =
  /([?&#;](?:access_token|id_token|refresh_token|token|code|key|api_?key|secret|client_secret|password|passwd|pwd|auth|authorization|session|sid|signature|sig|otp)=)[^&#\s]*/gi;

const ADDRESS_WITH_QUERY =
  /((?:https?:\/\/)?(?:localhost|[\w-]+(?:\.[\w-]+)+)(?::\d+)?(?:\/[^\s?#]*)?)[?#]\S+/gi;

const redactTitle = (title) =>
  String(title ?? "")
    .slice(0, MAX_INPUT_LENGTH)
    .replace(TOKEN_LIKE, HIDDEN)
    .replace(SECRET_PARAMETER, `$1${HIDDEN}`)
    .replace(ADDRESS_WITH_QUERY, `$1?${HIDDEN}`);

module.exports = { redactTitle, HIDDEN, MAX_INPUT_LENGTH };
