// Window titles can carry secrets. A page with no <title> shows its address instead, and addresses
// carry login tokens and one-time codes ("localhost:9999/?token=eyJ...",
// "accounts.google.com/signin/oauth/consent?part=AJi8..."). Titles are cleaned here, once, before
// they are classified or stored, so those secrets never reach the database.
//
// It removes only what is clearly a secret and leaves ordinary titles exactly as they were:
// "What is Java? - Google Search" and "C# tutorial" must come out unchanged.

const HIDDEN = "[hidden]";

// More than this many characters of a title are never looked at (and never stored anyway).
const MAX_INPUT_LENGTH = 2000;

// A login token: three base64url chunks joined by dots, the first starting with "eyJ".
const TOKEN_LIKE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;

// "?token=abc", "&code=xyz", "#access_token=...": keep the name, hide the value.
const SECRET_PARAMETER =
  /([?&#;](?:access_token|id_token|refresh_token|token|code|key|api_?key|secret|client_secret|password|passwd|pwd|auth|authorization|session|sid|signature|sig|otp)=)[^&#\s]*/gi;

// An address written out in a title: hide its query string and fragment, keep host and path.
// The host must look like one (localhost, or words joined by dots) so ordinary text is safe.
const ADDRESS_WITH_QUERY =
  /((?:https?:\/\/)?(?:localhost|[\w-]+(?:\.[\w-]+)+)(?::\d+)?(?:\/[^\s?#]*)?)[?#]\S+/gi;

const redactTitle = (title) =>
  String(title ?? "")
    .slice(0, MAX_INPUT_LENGTH)
    .replace(TOKEN_LIKE, HIDDEN)
    .replace(SECRET_PARAMETER, `$1${HIDDEN}`)
    .replace(ADDRESS_WITH_QUERY, `$1?${HIDDEN}`);

module.exports = { redactTitle, HIDDEN, MAX_INPUT_LENGTH };
