// Notificações via OneSignal: nada é pedido ao leitor sem ele tocar no sino.
const APP_ID = import.meta.env.PUBLIC_ONESIGNAL_APP_ID;
let client = null;

function toast(message) {
  const el = document.querySelector('[data-toast]');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 6000);
}

function paintBell() {
  const on = Boolean(client?.User.PushSubscription.optedIn);
  document.querySelectorAll('[data-push]').forEach((b) => {
    b.setAttribute('aria-checked', String(on));
  });
}

if (APP_ID) {
  // O SDK precisa estar pronto antes do toque: o iPhone só libera o pedido dentro do gesto.
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal) => {
    try {
      await OneSignal.init({
        appId: APP_ID,
        serviceWorkerPath: 'sync-news/sw.js',
        serviceWorkerParam: { scope: '/sync-news/' },
        promptOptions: { slidedown: { prompts: [{ type: 'push', autoPrompt: false }] } },
      });
      client = OneSignal;
      OneSignal.User.PushSubscription.addEventListener('change', paintBell);
      paintBell();
    } catch (e) { console.warn('Push indisponível', e); }
  });
  const script = document.createElement('script');
  script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
  script.defer = true;
  document.head.append(script);

  document.addEventListener('astro:page-load', paintBell);
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-push]')) return;
    if (!client) { toast('As notificações ainda estão carregando. Tente de novo em instantes.'); return; }
    if (!client.Notifications.isPushSupported()) {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      toast(ios ? 'No iPhone, adicione o Sync News à Tela de Início e ative o sino dentro do app.' : 'Este navegador não permite notificações.');
      return;
    }
    const sub = client.User.PushSubscription;
    let action;
    if (sub.optedIn) action = sub.optOut().then(() => toast('Notificações desativadas.'));
    else if (client.Notifications.permission) action = sub.optIn().then(() => toast('Pronto! Você vai receber cada nova edição.'));
    else action = client.Notifications.requestPermission().then(() => toast(client.Notifications.permission ? 'Pronto! Você vai receber cada nova edição.' : 'Permissão não concedida pelo navegador.'));
    action.then(paintBell).catch(() => toast('Não foi possível alterar as notificações.'));
  });
}
