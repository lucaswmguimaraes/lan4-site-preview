/**
 * main.js — Liveblocks clone interactions
 * Replica os comportamentos do site original: dropdowns, mobile menu,
 * pointer glow, cursor animations, header scroll state.
 */

/* ─── Utils ─────────────────────────────────────────────────────────── */
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/* ─── LAN4 Tracking Layer (GTM dataLayer) ───────────────────────────────
   Empurra eventos padronizados pro GTM: lead_form_submit (conversão),
   form_start e cta_click. user_data vai em claro e normalizado — o
   Google tag e o Meta Pixel hasheiam (SHA-256) no navegador antes de
   enviar (Enhanced Conversions / Advanced Matching). */
window.dataLayer = window.dataLayer || [];

function lan4EventId() {
  return (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'evt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}

function lan4NormalizeEmail(raw) {
  return (raw || '').trim().toLowerCase();
}

/* Telefone → E.164 (+55DDDNÚMERO) */
function lan4NormalizePhone(raw) {
  var d = (raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return '+' + d;
}

function lan4SplitName(nome) {
  var parts = (nome || '').trim().split(/\s+/);
  return {
    first: (parts[0] || '').toLowerCase(),
    last: (parts.length > 1 ? parts[parts.length - 1] : '').toLowerCase()
  };
}

/* Chamar APENAS no callback de sucesso do envio ao RD Station */
function lan4PushLead(identificador, p) {
  var name = lan4SplitName(p.nome);
  window.dataLayer.push({
    event: 'lead_form_submit',
    form_identifier: identificador,
    event_id: lan4EventId(),
    lead: {
      company: p.empresa || '',
      cargo: p.cargo || '',
      faturamento: p.faturamento || '',
      ticket: p.ticket || ''
    },
    user_data: {
      email: lan4NormalizeEmail(p.email),
      phone: lan4NormalizePhone(p.telefone),
      first_name: name.first,
      last_name: name.last
    }
  });
}

/* ─── UTMs → RD Station ─────────────────────────────────────────────────
   Captura os UTMs na entrada, persiste na sessão (sobrevive à navegação
   na página) e injeta no payload da conversão do RD. O comercial recebe
   o serviço de interesse via cf_servico_interesse (derivado do
   utm_content prefixado das campanhas de Search / utm_term do Meta). */
var LAN4_UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

(function () {
  try {
    var qs = new URLSearchParams(window.location.search);
    var found = {};
    LAN4_UTM_KEYS.forEach(function (k) { var v = qs.get(k); if (v) found[k] = v; });
    if (Object.keys(found).length) sessionStorage.setItem('lan4_utms', JSON.stringify(found));
  } catch (e) { /* sessionStorage indisponível: segue sem UTMs */ }
})();

function lan4GetUtms() {
  try { return JSON.parse(sessionStorage.getItem('lan4_utms') || '{}'); }
  catch (e) { return {}; }
}

function lan4ServicoInteresse(utms) {
  var mapa = {
    vendas: 'Vendas e CRM', social: 'Gestão de Redes Sociais',
    recrut: 'Recrutamento e Seleção', midia: 'Mídia Paga',
    audio: 'Audiovisual e Conteúdo', eventos: 'Eventos Corporativos',
    mkt: 'Marketing Digital', nicho: 'Nichos', ia: 'Inteligência Artificial',
    marca: 'Marca/Institucional'
  };
  var c = (utms.utm_content || '').toLowerCase();
  for (var k in mapa) { if (c.indexOf(k) === 0) return mapa[k]; }
  /* Meta: o conjunto (serviço/nicho) viaja no utm_term ({{adset.name}}) */
  return utms.utm_term || utms.utm_content || '';
}

function lan4RdUtmPayload() {
  var u = lan4GetUtms();
  var p = {};
  if (u.utm_source)   { p.traffic_source = u.utm_source; p.cf_utm_source = u.utm_source; }
  if (u.utm_medium)   p.cf_utm_medium   = u.utm_medium;
  if (u.utm_campaign) p.cf_utm_campaign = u.utm_campaign;
  if (u.utm_term)     p.cf_utm_term     = u.utm_term;
  if (u.utm_content)  p.cf_utm_content  = u.utm_content;
  /* Em páginas de serviço (/s/<slug>/), window.LAN4_SERVICO_PAGINA garante o
     serviço de interesse mesmo em acesso sem UTM (orgânico/direto/compartilhado) */
  var servico = lan4ServicoInteresse(u) || window.LAN4_SERVICO_PAGINA || '';
  if (servico) p.cf_servico_de_interesse = servico;
  return p;
}

/* ─── Validação de telefone (11 dígitos corridos: DDD + celular) ──────
   Retorna '' se válido, ou a mensagem de erro explicando o que corrigir. */
function lan4ValidaTelefone(raw) {
  var val = (raw || '').trim();
  if (!val) return 'Preencha o telefone (ex.: 11998765432).';
  var invalidos = val.replace(/[0-9]/g, '');
  if (invalidos) {
    var unicos = invalidos.split('').filter(function (c, i, a) { return a.indexOf(c) === i; })
      .map(function (c) { return c === ' ' ? 'espaço' : '\"' + c + '\"'; }).join(', ');
    return 'O telefone deve ter apenas números, sem ' + unicos + '. Digite DDD + celular corrido (ex.: 11998765432).';
  }
  if (val.length === 13 && val.indexOf('55') === 0) {
    return 'Digite sem o código do país (55): apenas DDD + celular, 11 dígitos (ex.: 11998765432).';
  }
  if (val.length !== 11) {
    return 'O telefone deve ter 11 dígitos (DDD + celular, ex.: 11998765432). Você digitou ' + val.length + '.';
  }
  return '';
}

/* Valor de um campo por name — cobre input/select, radio e checkbox */
function lan4CampoValor(form, name) {
  var el = form.querySelector('[name="' + name + '"]');
  if (!el) return '';
  if (el.type === 'radio') {
    var marcado = form.querySelector('[name="' + name + '"]:checked');
    return marcado ? marcado.value : '';
  }
  if (el.type === 'checkbox') return el.checked ? 'sim' : '';
  return (el.value || '').trim();
}

/* Validação de campos obrigatórios — retorna '' ou mensagem com o campo faltante */
function lan4ValidaObrigatorios(form, campos) {
  for (var i = 0; i < campos.length; i++) {
    if (!lan4CampoValor(form, campos[i][0])) return 'Preencha o campo obrigatório: ' + campos[i][1] + '.';
  }
  return '';
}

/* Campos obrigatórios declarados no HTML: data-req="name:Rótulo,name:Rótulo" por etapa */
function lan4ReqEtapa(step) {
  return (step.getAttribute('data-req') || '').split(',').filter(Boolean).map(function (par) {
    var i = par.indexOf(':');
    return [par.slice(0, i).trim(), par.slice(i + 1).trim()];
  });
}

/* Todos os obrigatórios do form (união das etapas) — usado na validação do submit */
function lan4ReqDoForm(form) {
  var campos = [];
  $$('.lf-step', form).forEach(function (s) { campos = campos.concat(lan4ReqEtapa(s)); });
  return campos;
}

/* Identificador de conversão do RD por form: declarado em data-rd-id no <form>
   (páginas de serviço usam identificadores próprios, ex.: lan4-lp-redes-sociais) */
function lan4FormId(form, fallback) {
  return form.getAttribute('data-rd-id') || fallback || form.id || 'form-sem-id';
}

/* Campos extras específicos da página: grupos com data-rd-cf="cf_x" data-rd-name="name"
   entram no payload do RD sem mexer no JS — cada página declara os seus no HTML */
function lan4ExtrasRd(form) {
  var extras = {};
  $$('[data-rd-cf]', form).forEach(function (el) {
    var valor = lan4CampoValor(form, el.getAttribute('data-rd-name') || '');
    if (valor) extras[el.getAttribute('data-rd-cf')] = valor;
  });
  return extras;
}

/* ─── Sticky CTA mobile ────────────────────────────────────────────────
   Aparece após rolar a 1ª dobra e some quando o formulário de contato
   está visível (para não cobrir campos/botão de envio). Clique já é
   trackeado pelo listener global de data-cta. */
(function () {
  var bar = document.getElementById('sticky-cta');
  if (!bar) return;
  var contato = document.getElementById('contato');
  var formVisivel = false;

  function atualiza() {
    var mostrar = window.scrollY > 500 && !formVisivel;
    bar.classList.toggle('is-visible', mostrar);
    bar.setAttribute('aria-hidden', mostrar ? 'false' : 'true');
  }

  /* iOS Safari: a barra de ferramentas inferior do navegador expande ao
     arrastar para cima e cobre elementos fixados em bottom:0 (que ancoram
     no viewport de LAYOUT). Aqui a barra é recolada ao viewport VISUAL
     sempre que a UI do Safari cresce/encolhe. */
  function ajustaViewport() {
    var vv = window.visualViewport;
    if (!vv) return;
    var offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    bar.style.bottom = offset + 'px';
  }

  if (contato && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      formVisivel = entries[0].isIntersecting;
      atualiza();
    }, { rootMargin: '0px 0px -15% 0px' }).observe(contato);
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', ajustaViewport, { passive: true });
    window.visualViewport.addEventListener('scroll', ajustaViewport, { passive: true });
  }
  window.addEventListener('resize', ajustaViewport, { passive: true });
  window.addEventListener('scroll', atualiza, { passive: true });
  ajustaViewport();
  atualiza();
})();

/* form_start — primeira interação com cada formulário (1× por form) */
document.addEventListener('focusin', function (e) {
  var form = e.target && e.target.closest ? e.target.closest('form') : null;
  if (!form || form.dataset.lan4Started) return;
  form.dataset.lan4Started = '1';
  window.dataLayer.push({
    event: 'form_start',
    form_identifier: lan4FormId(form, form.id === 'lf' ? 'lan4-contato-site' : (form.id === 'lf2' ? 'lan4-servicos-cta' : ''))
  });
});

/* cta_click — qualquer elemento com data-cta */
document.addEventListener('click', function (e) {
  var el = e.target && e.target.closest ? e.target.closest('[data-cta]') : null;
  if (!el) return;
  window.dataLayer.push({
    event: 'cta_click',
    cta_id: el.getAttribute('data-cta'),
    cta_text: (el.textContent || '').trim().slice(0, 80),
    cta_location: el.getAttribute('data-cta-location') || ''
  });
});
/* ─── Formulários multi-etapas ──────────────────────────────────────────
   Progress bar, validação por etapa e evento form_step no dataLayer —
   cada avanço válido vira um degrau do funil de abandono no GA4. */
function lan4MultiStep(form, identificador) {
  if (!form) return;
  var steps = $$('.lf-step', form);
  if (!steps.length) return;
  var segs  = $$('.lf-progress-seg', form);
  var count = $('[data-step-current]', form);
  var title = $('[data-step-title]', form);
  var cur = 0;

  function mostra(i) {
    steps.forEach(function (s, j) { s.classList.toggle('is-active', j === i); });
    segs.forEach(function (s, j) {
      s.classList.toggle('is-done', j < i);
      s.classList.toggle('is-active', j === i);
    });
    if (count) count.textContent = String(i + 1);
    if (title) title.textContent = steps[i].getAttribute('data-step-title') || '';
    cur = i;
  }

  function validaEtapa(i) {
    var step = steps[i];
    var erro = lan4ValidaObrigatorios(form, lan4ReqEtapa(step));
    if (!erro && step.querySelector('[name="telefone"]')) erro = lan4ValidaTelefone(lan4CampoValor(form, 'telefone'));
    var m = $('.lf-step-msg', step);
    if (m) { m.style.display = erro ? 'block' : 'none'; m.textContent = erro || ''; }
    return !erro;
  }

  /* Enter num input antes da última etapa avança em vez de submeter */
  form.lan4StepGuard = function () {
    if (cur >= steps.length - 1) return false;
    var btn = $('.lf-next', steps[cur]);
    if (btn) btn.click();
    return true;
  };
  form.lan4ValidaEtapaAtual = function () { return validaEtapa(cur); };
  form.lan4Reinicia = function () { mostra(0); };

  $$('.lf-next', form).forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!validaEtapa(cur)) return;
      window.dataLayer.push({
        event: 'form_step',
        form_identifier: identificador,
        form_step_number: cur + 1,
        form_step_name: steps[cur].getAttribute('data-step-name') || '',
        form_step_total: steps.length
      });
      mostra(cur + 1);
      (form.closest('.lf-wrap') || form).scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  $$('.lf-back', form).forEach(function (btn) {
    btn.addEventListener('click', function () { if (cur > 0) mostra(cur - 1); });
  });

  mostra(0);
}
(function () {
  var lf  = document.getElementById('lf');
  var lf2 = document.getElementById('lf2');
  if (lf)  lan4MultiStep(lf,  lan4FormId(lf,  'lan4-contato-site'));
  if (lf2) lan4MultiStep(lf2, lan4FormId(lf2, 'lan4-servicos-cta'));
})();

/* ─── Envio ao RD Station — com modo prévia ─────────────────────────────
   Fora de lan4.com.br (window.LAN4_PREVIEW, definido no index.html) o
   POST não acontece: simula sucesso p/ validar a UX sem criar lead. */
function lan4EnviaRd(payload) {
  if (window.LAN4_PREVIEW) {
    return new Promise(function (res) {
      setTimeout(function () {
        res({ ok: true, status: 200, json: function () { return Promise.resolve({ preview: true }); } });
      }, 500);
    });
  }
  return fetch('https://app.rdstation.com.br/api/1.3/conversions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

/* Selo visual do modo prévia */
if (window.LAN4_PREVIEW) {
  var lan4Badge = document.createElement('div');
  lan4Badge.className = 'lan4-preview-badge';
  lan4Badge.textContent = 'Prévia de validação · envios desativados';
  document.body.appendChild(lan4Badge);
}

/* ─── fim LAN4 Tracking Layer ───────────────────────────────────────── */

/* Firefox (Gecko/WebRender) reteselagem de clip-path com "round" animado
   é bem mais cara que no Chromium — usado pra simplificar essa animação
   só nesse motor (ver .servicos-section-bg / .problems-section-bg). */
const IS_FIREFOX = CSS.supports('-moz-appearance', 'none');

/* ─── Header scroll ──────────────────────────────────────────────────── */
const header = $('.header');

const COMPACT_THRESHOLD = 10;

const handleScroll = () => {
  const y = window.scrollY;
  header.classList.toggle('header--scrolled', y > 10);
  header.classList.toggle('header--compact',  y > COMPACT_THRESHOLD);
};

/* Agrupa todo trabalho de scroll (header + bg clip-path) num único rAF
   por frame — evita rodar leitura de layout + repaint a cada evento
   nativo de scroll, que pode disparar dezenas de vezes por frame. */
let scrollScheduled = false;
function onScroll(extra) {
  if (scrollScheduled) return;
  scrollScheduled = true;
  requestAnimationFrame(() => {
    scrollScheduled = false;
    handleScroll();
    extra?.forEach(fn => fn());
  });
}

const scrollCallbacks = [];
window.addEventListener('scroll', () => onScroll(scrollCallbacks), { passive: true });
handleScroll();

/* ─── Pointer glow (radial gradient seguindo o mouse) ───────────────── */
// Listener por botão (só roda enquanto o mouse está sobre ele) em vez de
// um mousemove global que reconsultava o DOM e recalculava a posição de
// TODOS os botões a cada pixel de movimento do mouse na página inteira.
$$('[data-pointer-glow]').forEach(btn => {
  btn.addEventListener('mousemove', (e) => {
    const rect = btn.getBoundingClientRect();
    btn.style.setProperty('--px', `${e.clientX - rect.left}px`);
    btn.style.setProperty('--py', `${e.clientY - rect.top}px`);
  });
});

/* ─── Dropdown navigation ────────────────────────────────────────────── */
let closeTimer = null;

$$('.nav-item').forEach(item => {
  const btn      = item.querySelector('.nav-btn');
  const dropdown = item.querySelector('.dropdown');
  if (!btn || !dropdown) return;

  const open = () => {
    clearTimeout(closeTimer);
    // fecha outros dropdowns
    $$('.dropdown[data-state="open"]').forEach(d => {
      if (d !== dropdown) {
        d.dataset.state = 'closed';
        d.closest('.nav-item')?.querySelector('.nav-btn')?.removeAttribute('data-state');
      }
    });
    dropdown.dataset.state = 'open';
    btn.dataset.state = 'open';
    positionArrow(dropdown, btn);
  };

  const close = (delay = 120) => {
    closeTimer = setTimeout(() => {
      dropdown.dataset.state = 'closed';
      delete btn.dataset.state;
    }, delay);
  };

  btn.addEventListener('mouseenter', open);
  btn.addEventListener('focus',      open);
  btn.addEventListener('mouseleave', () => close());
  btn.addEventListener('blur',       () => close(200));

  dropdown.addEventListener('mouseenter', () => clearTimeout(closeTimer));
  dropdown.addEventListener('mouseleave', () => close());

  // Fecha com Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') close(0);
  });
});

// Fecha ao clicar fora
document.addEventListener('click', e => {
  if (!e.target.closest('.nav-item')) {
    $$('.dropdown[data-state="open"]').forEach(d => {
      d.dataset.state = 'closed';
      d.closest('.nav-item')?.querySelector('.nav-btn')?.removeAttribute('data-state');
    });
  }
});

/**
 * Alinha a setinha do dropdown com o botão que o abriu.
 * O site original faz isso com JS para compensar o translate(-50%).
 */
function positionArrow(dropdown, btn) {
  const arrow = dropdown.querySelector('.dropdown-arrow');
  if (!arrow) return;
  const ddRect  = dropdown.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  const btnMid  = btnRect.left + btnRect.width / 2;
  const ddMid   = ddRect.left  + ddRect.width  / 2;
  const offset  = btnMid - ddMid;
  dropdown.style.setProperty('--arrow-offset', `${offset}px`);
}

/* ─── Mobile menu (panel deslizante) ────────────────────────────────── */
const menuToggle  = $('.menu-toggle');
const mobilePanel = $('#mobilePanel');

if (menuToggle && mobilePanel) {
  let panelOpen = false;

  function openPanel() {
    panelOpen = true;
    mobilePanel.classList.add('is-open');
    menuToggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closePanel() {
    panelOpen = false;
    mobilePanel.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  menuToggle.addEventListener('click', () => panelOpen ? closePanel() : openPanel());

  $$('.mobile-panel-link', mobilePanel).forEach(link => {
    link.addEventListener('click', closePanel);
  });

  const panelCta = mobilePanel.querySelector('.mobile-panel-cta .btn');
  if (panelCta) panelCta.addEventListener('click', closePanel);
}

/* ─── Serviços — Carrossel infinito ─────────────────────────────────── */
(function () {
  const viewport = $('.servicos-carousel-viewport');
  const track    = $('.servicos-track');
  const prevBtn  = $('.servicos-arrow--prev');
  const nextBtn  = $('.servicos-arrow--next');
  if (!track || !viewport) return;

  function GAP() {
    return parseFloat(getComputedStyle(track).columnGap) || 20;
  }

  const origCards = [...track.children]; /* 6 cards reais */
  const N = origCards.length;

  /* Estrutura final: [clone1..N] [real1..N] [clone1..N]  (3N = 18 cards) */
  /* Prepend: clones em ordem dos originais */
  for (let i = N - 1; i >= 0; i--) {
    track.insertBefore(origCards[i].cloneNode(true), track.firstChild);
  }
  /* Append */
  origCards.forEach(c => track.appendChild(c.cloneNode(true)));

  let idx = N; /* começa no primeiro card real */
  let busy = false;

  function cardW() {
    return track.children[0]?.offsetWidth || 0;
  }

  /* No mobile (1 card por vez, mais estreito que o viewport) centraliza
     o card ativo, deixando os vizinhos espiarem nas duas laterais. */
  function centerOffset() {
    const vw = viewport.offsetWidth;
    const cw = cardW();
    return vw <= 500 ? (vw - cw) / 2 : 0;
  }

  /* Posiciona sem animação */
  function snap(i) {
    track.style.transition = 'none';
    track.style.transform  = `translateX(${centerOffset() - (i * (cardW() + GAP()))}px)`;
    void track.offsetWidth; /* force reflow */
    track.style.transition = '';
  }

  /* Posiciona com animação */
  function goTo(i) {
    if (busy) return;
    busy = true;
    idx = i;
    track.style.transform = `translateX(${centerOffset() - (idx * (cardW() + GAP()))}px)`;
  }

  track.addEventListener('transitionend', e => {
    if (e.target !== track) return;
    busy = false;
    if (idx < N)       { idx += N; snap(idx); }
    else if (idx >= N * 2) { idx -= N; snap(idx); }
  });

  /* Arrows sempre habilitadas (loop infinito) */
  [prevBtn, nextBtn].forEach(b => {
    b.disabled = false;
    b.classList.remove('is-disabled');
  });

  /* Auto-play — avança 1 card a cada 2 segundos, pausa no hover/foco */
  let autoTimer = null;

  function startAuto() {
    stopAuto();
    autoTimer = setInterval(() => goTo(idx + 1), 2000);
  }

  function stopAuto() {
    clearInterval(autoTimer);
  }

  const wrap = viewport.closest('.servicos-carousel-wrap') || viewport.parentElement;
  wrap.addEventListener('mouseenter', stopAuto);
  wrap.addEventListener('mouseleave', startAuto);
  wrap.addEventListener('focusin',    stopAuto);
  wrap.addEventListener('focusout',   startAuto);

  /* Pausa o autoplay fora da tela — sem isso ele fica avançando (e
     disparando transitionend) pra sempre, mesmo com o carrossel longe
     da viewport. */
  new IntersectionObserver(entries => {
    entries.forEach(entry => entry.isIntersecting ? startAuto() : stopAuto());
  }, { threshold: 0 }).observe(wrap);

  prevBtn.addEventListener('click', () => { stopAuto(); goTo(idx - 1); startAuto(); });
  nextBtn.addEventListener('click', () => { stopAuto(); goTo(idx + 1); startAuto(); });

  window.addEventListener('resize', () => snap(idx), { passive: true });

  requestAnimationFrame(() => requestAnimationFrame(() => { snap(idx); startAuto(); }));

  /* ── Drag / swipe — mouse e touch ── */
  let dragStartX = 0;
  let dragDeltaX = 0;
  let dragActive = false;

  /* ── Drag / swipe — sem setPointerCapture para não quebrar clicks ── */
  viewport.addEventListener('pointerdown', e => {
    dragStartX = e.clientX;
    dragDeltaX = 0;
    dragActive = true;
    track.style.transition = 'none';
    stopAuto();
  });

  window.addEventListener('pointermove', e => {
    if (!dragActive) return;
    dragDeltaX = e.clientX - dragStartX;
    track.style.transform = `translateX(${centerOffset() - (idx * (cardW() + GAP())) + dragDeltaX}px)`;
  });

  window.addEventListener('pointerup', () => {
    if (!dragActive) return;
    dragActive = false;
    track.style.transition = '';
    busy = false;
    if      (dragDeltaX < -50) goTo(idx + 1);
    else if (dragDeltaX >  50) goTo(idx - 1);
    else                        snap(idx);
    startAuto();
  });

  window.addEventListener('pointercancel', () => {
    if (!dragActive) return;
    dragActive = false;
    track.style.transition = '';
    snap(idx);
    startAuto();
  });

  /* Evita abrir popup quando o usuário estava arrastando */
  viewport.addEventListener('click', e => {
    if (Math.abs(dragDeltaX) > 10) e.stopPropagation();
  }, true);
})();

/* ─── Problemas — ticker JS-driven com drag ─────────────────────────── */
(function () {
  const wrap  = $('.problems-track-wrap');
  const track = $('.problems-track');
  if (!wrap || !track) return;

  /* Desativa animação CSS — controle total via JS */
  track.style.animation = 'none';

  const CYCLE_SECS = 34;
  let posX      = 0;
  let lastTs    = null;
  let hovering  = false;
  let dragging  = false;
  let dragStartX = 0;
  let dragPosX   = 0;
  let rafId     = null;

  function totalW() { return track.scrollWidth / 2; }

  function tick(ts) {
    if (lastTs !== null && !dragging && !hovering) {
      const dt    = Math.min((ts - lastTs) / 1000, 0.05); /* cap a 50ms */
      const tw    = totalW();
      const speed = tw / CYCLE_SECS;
      posX -= speed * dt;
      if (posX <= -tw) posX += tw;
    }
    lastTs = ts;
    track.style.transform = `translateX(${posX}px)`;
    rafId = requestAnimationFrame(tick);
  }

  /* Só anima enquanto a seção está visível — sem isso o loop rodava pra
     sempre desde o load, lendo scrollWidth (força layout) a cada frame
     em QUALQUER lugar da página, competindo por CPU com o resto do site. */
  const visibilityObs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting && rafId === null) {
        lastTs = null; /* evita salto de dt ao retomar depois de pausado */
        rafId = requestAnimationFrame(tick);
      } else if (!entry.isIntersecting && rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    });
  }, { threshold: 0 });
  visibilityObs.observe(wrap);

  /* Pausa no hover — apenas dispositivos com cursor real */
  wrap.addEventListener('mouseenter', () => { hovering = true;  });
  wrap.addEventListener('mouseleave', () => { hovering = false; });

  /* Drag */
  wrap.addEventListener('pointerdown', e => {
    dragging   = true;
    dragStartX = e.clientX;
    dragPosX   = posX;
  });

  window.addEventListener('pointermove', e => {
    if (!dragging) return;
    const tw = totalW();
    posX = dragPosX + (e.clientX - dragStartX);
    while (posX > 0)   posX -= tw;
    while (posX < -tw) posX += tw;
  });

  window.addEventListener('pointerup',     () => { dragging = false; });
  window.addEventListener('pointercancel', () => { dragging = false; });
})();

/* ─── Serviços — Background scroll-driven ───────────────────────────── */
(function () {
  const section = $('.servicos-section');
  const bg      = section?.querySelector('.servicos-section-bg');
  if (!section || !bg) return;

  let lastClip = null;

  function updateBg() {
    const vw   = window.innerWidth;
    const rect = section.getBoundingClientRect();
    const vh   = window.innerHeight;

    /* progress: 0 quando seção entra pela base, 1 quando topo chega a 25% do viewport */
    const progress = Math.max(0, Math.min(1, (vh - rect.top) / (vh * 0.75)));

    const startHalf = vw > 640 ? 400 : 150; /* 800px desktop / 300px mobile dividido por 2 */
    const half      = startHalf + (vw / 2 - startHalf) * progress;
    const clip      = Math.round(Math.max(0, vw / 2 - half));

    /* O raio arredondado é a parte mais cara de recalcular a cada frame
       (o navegador retesela os cantos do clip-path). Zerando-o logo no
       início do trecho (35% do progresso) — em vez de ao longo de todo
       ele — mantém a mesma duração/distância de scroll, mas deixa a
       maior parte da transição usando só um clip retangular, bem mais
       leve de renderizar. */
    const radiusProgress = IS_FIREFOX ? 1 : Math.min(1, progress / 0.35);
    const radius = Math.round(44 * (1 - radiusProgress));

    const next = `inset(0 ${clip}px round ${radius}px)`;
    if (next === lastClip) return;
    lastClip = next;
    bg.style.clipPath = next;
  }

  scrollCallbacks.push(updateBg);
  window.addEventListener('resize', updateBg, { passive: true });
  updateBg();
})();

/* ─── Problemas — Background sólido preto, mesma animação de "pílula
   que expande" da seção de serviços ──────────────────────────────── */
(function () {
  const section = $('.problems-section');
  const bg      = section?.querySelector('.problems-section-bg');
  if (!section || !bg) return;

  let lastClip = null;

  function updateBg() {
    const vw   = window.innerWidth;
    const rect = section.getBoundingClientRect();
    const vh   = window.innerHeight;

    const progress = Math.max(0, Math.min(1, (vh - rect.top) / (vh * 0.75)));

    const startHalf = vw > 640 ? 400 : 150;
    const half      = startHalf + (vw / 2 - startHalf) * progress;
    const clip      = Math.round(Math.max(0, vw / 2 - half));

    const radiusProgress = IS_FIREFOX ? 1 : Math.min(1, progress / 0.35);
    const radius = Math.round(44 * (1 - radiusProgress));

    const next = `inset(0 ${clip}px round ${radius}px)`;
    if (next === lastClip) return;
    lastClip = next;
    bg.style.clipPath = next;
  }

  scrollCallbacks.push(updateBg);
  window.addEventListener('resize', updateBg, { passive: true });
  updateBg();
})();

/* ─── Lazy background-images ─────────────────────────────────────────
   Cards e popups usam data-bg em vez de background-image inline no HTML.
   Sem isso, o navegador baixava TODAS as imagens de fundo já no carregamento
   da página — incluindo as dos 14 popups de serviço, que ficam sempre no
   DOM (display:flex) e só viram invisíveis via opacity. Isso somava ~2MB
   de imagens de popups fechados baixadas antes de qualquer interação. */
function applyLazyBg(el) {
  if (!el.dataset.bg) return;
  el.style.backgroundImage = `url('${el.dataset.bg}')`;
  delete el.dataset.bg;
}

/* Cards: carregam ao chegar perto da viewport (scroll) */
const bgObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      applyLazyBg(entry.target);
      bgObserver.unobserve(entry.target);
    }
  });
}, { rootMargin: '300px' });

$$('.servico-card-img[data-bg]').forEach(el => bgObserver.observe(el));

/* ─── Serviços — Popups ──────────────────────────────────────────────── */
let _lastFocused = null;

function openServicosPopup(popupId) {
  const popup = $('#' + popupId);
  if (!popup) return;
  /* Popups são fixed/inset:0 — IntersectionObserver os considera sempre
     visíveis mesmo fechados, então a imagem só pode ser carregada aqui,
     no momento real da abertura. */
  popup.querySelectorAll('[data-bg]').forEach(applyLazyBg);
  _lastFocused = document.activeElement;
  popup.classList.add('is-open');
  popup.removeAttribute('aria-hidden');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => popup.querySelector('.servico-popup-close')?.focus());
}

function closeServicosPopup(popup) {
  popup.classList.remove('is-open');
  popup.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  _lastFocused?.focus();
}

$$('.servico-card, .bu-card').forEach(card => {
  const open = () => openServicosPopup(card.dataset.popup);
  card.addEventListener('click', open);
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
});

$$('.servico-popup-close').forEach(btn => {
  btn.addEventListener('click', () => closeServicosPopup(btn.closest('.servico-popup')));
});

/* Clique no backdrop (fora do card) fecha o popup */
$$('.servico-popup').forEach(popup => {
  popup.addEventListener('click', e => {
    if (!e.target.closest('.servico-popup-card')) closeServicosPopup(popup);
  });
});

/* CTA "Saiba mais" dentro do popup — fecha o popup antes de rolar até o form */
$$('.servico-popup-copy a[href^="#"]').forEach(link => {
  link.addEventListener('click', () => closeServicosPopup(link.closest('.servico-popup')));
});

/* Footer — botões que abrem popups de serviços */
$$('[data-popup-open]').forEach(btn => {
  btn.addEventListener('click', () => openServicosPopup(btn.dataset.popupOpen));
});

/* ─── Mini-form da seção de serviços ────────────────────────────────── */
(function () {
  var form = document.getElementById('lf2');
  var msg  = document.getElementById('lf2-msg');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (form.lan4StepGuard && form.lan4StepGuard()) return; // Enter antes da última etapa só avança
    var v   = function (n) { return lan4CampoValor(form, n); };
    var btn = form.querySelector('button[type="submit"]');
    var btnTexto = btn.textContent;
    var identificador = lan4FormId(form, 'lan4-servicos-cta');

    var erro = lan4ValidaObrigatorios(form, lan4ReqDoForm(form)) || lan4ValidaTelefone(v('telefone'));
    if (erro) {
      msg.className = 'lf-msg err';
      msg.style.display = 'block';
      msg.textContent = erro;
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Enviando…';
    msg.style.display = 'none';

    // Captura os valores ANTES do fetch/reset — usados no tracking pós-sucesso
    var lead = {
      nome: v('nome'), email: v('email'), telefone: v('telefone'),
      empresa: v('empresa'), cargo: v('cargo'),
      faturamento: v('faturamento'), ticket: v('ticket')
    };

    lan4EnviaRd(Object.assign({
      token_rdstation:              'd5d170dfe71825a3ebc37e6699f10652',
      identificador:                identificador,
      email:                        lead.email,
      nome:                         lead.nome,
      telefone:                     lead.telefone,
      empresa:                      lead.empresa,
      cf_cargo:                     lead.cargo,
      cf_faturamento_medio_mensal:  lead.faturamento,
      cf_ticket_medio_aproximado:   lead.ticket
    }, lan4ExtrasRd(form), lan4RdUtmPayload()))
    .then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) throw new Error(r.status);
        lan4PushLead(identificador, lead);
        form.reset();
        form.classList.add('is-sent');
        msg.className = 'lf-msg ok';
        msg.style.display = 'block';
        msg.textContent = '✓ Recebemos suas informações! Alguém do nosso time vai entrar em contato com você em breve.';
      });
    })
    .catch(function () {
      msg.className = 'lf-msg err';
      msg.style.display = 'block';
      msg.textContent = 'Ocorreu um erro. Tente novamente.';
    })
    .finally(function () {
      btn.disabled = false;
      btn.textContent = btnTexto;
    });
  });
})();

/* ─── Formulário de contato → RD Station ────────────────────────────── */
(function () {
  var form = document.getElementById('lf');
  var msg  = document.getElementById('lf-msg');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (form.lan4StepGuard && form.lan4StepGuard()) return; // Enter antes da última etapa só avança
    var v   = function (n) { return lan4CampoValor(form, n); };
    var btn = form.querySelector('button[type="submit"]');
    var btnTexto = btn.textContent;
    var identificador = lan4FormId(form, 'lan4-contato-site');

    // Validação: obrigatórios declarados em data-req + telefone 11 dígitos corridos
    var erro = lan4ValidaObrigatorios(form, lan4ReqDoForm(form)) || lan4ValidaTelefone(v('telefone'));
    if (erro) {
      msg.className = 'lf-msg err';
      msg.style.display = 'block';
      msg.textContent = erro;
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Enviando…';
    msg.style.display = 'none';

    // Captura os valores ANTES do fetch/reset — usados no tracking pós-sucesso
    var lead = {
      nome: v('nome'), email: v('email'), telefone: v('telefone'),
      empresa: v('empresa'), cargo: v('cargo'),
      faturamento: v('faturamento'), ticket: v('ticket')
    };

    lan4EnviaRd(Object.assign({
      token_rdstation:              'd5d170dfe71825a3ebc37e6699f10652',
      identificador:                identificador,
      email:                        lead.email,
      nome:                         lead.nome,
      telefone:                     lead.telefone,
      empresa:                      lead.empresa,
      cf_cargo:                     lead.cargo,
      cf_faturamento_medio_mensal:  lead.faturamento,
      cf_ticket_medio_aproximado:   lead.ticket
    }, lan4ExtrasRd(form), lan4RdUtmPayload()))
    .then(function (r) {
      return r.json().then(function (data) {
        console.log('[RD Station] status:', r.status, 'response:', data);
        if (!r.ok) throw new Error(r.status + ' – ' + JSON.stringify(data));
        lan4PushLead(identificador, lead);
        form.reset();
        form.classList.add('is-sent');
        msg.className = 'lf-msg ok';
        msg.style.display = 'block';
        msg.innerHTML = '✓ Recebemos suas informações!<br>Alguém do nosso time vai entrar em contato com você em breve — fique de olho no WhatsApp e no e-mail.';
      });
    })
    .catch(function (err) {
      console.error('[RD Station] erro:', err);
      msg.className = 'lf-msg err';
      msg.style.display = 'block';
      msg.textContent = 'Ocorreu um erro. Tente novamente ou fale pelo WhatsApp.';
    })
    .finally(function () {
      btn.disabled = false;
      btn.textContent = btnTexto;
    });
  });
})();

/* ─── Pausa vídeos em loop quando saem da tela (reduz decode simultâneo) ──
   Inclui o vídeo do hero — sem isso ele decodifica pra sempre, mesmo
   rolado pra fora da tela, competindo com todo o resto por CPU/GPU. */
(function () {
  const videos = $$('.mandala-video, .hero-video-bg');
  if (!videos.length) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => entry.isIntersecting ? entry.target.play() : entry.target.pause());
  }, { threshold: 0.1 });
  videos.forEach(v => obs.observe(v));
})();

/* ─── FAQ accordion ──────────────────────────────────────────────────── */
$$('.faq-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const isOpen = btn.getAttribute('aria-expanded') === 'true';
    const answer = btn.nextElementSibling;

    // Fecha todos os outros
    $$('.faq-question').forEach(other => {
      if (other !== btn) {
        other.setAttribute('aria-expanded', 'false');
        other.nextElementSibling.classList.remove('is-open');
      }
    });

    // Alterna este
    btn.setAttribute('aria-expanded', String(!isOpen));
    answer.classList.toggle('is-open', !isOpen);
  });
});

/* ─── Scroll reveal (IntersectionObserver) ──────────────────────────── */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

$$('.reveal').forEach(el => revealObserver.observe(el));
