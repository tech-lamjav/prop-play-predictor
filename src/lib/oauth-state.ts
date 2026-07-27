// Chaves de sessionStorage pra atravessar o redirect do OAuth (Google).
// O browser sai do app e volta em /auth/callback, então location.state e o
// estado React do /auth se perdem — guardamos destino pós-login e código de
// indicação antes de sair, e o AuthCallback consome (e limpa) na volta.
export const OAUTH_REDIRECT_KEY = 'oauth_redirect_target';
export const OAUTH_REFERRAL_KEY = 'oauth_referral_code';
