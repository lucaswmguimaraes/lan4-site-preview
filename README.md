# LAN4 — Prévia dos formulários multi-etapas (CRO)

Prévia de validação das mudanças nos 2 formulários do site [lan4.com.br](https://lan4.com.br), para aprovação antes de subir ao ar.

**Ver a prévia:** https://lucaswmguimaraes.github.io/lan4-site-preview/

## O que mudou

- Os 2 formulários (form principal da seção Contato e mini-form da seção de serviços) viraram **3 etapas**: (1) sobre a empresa, (2) desafio/cargo, (3) contato.
- Perguntas de **seleção primeiro** (toque único, sem digitação), **nome/email/telefone por último**.
- **Barra de progresso** acima do formulário ("Etapa X de 3").
- Selects viraram **botões de toque** (mobile-first, alvo de 48px).
- Botão Voltar sem perder dados preenchidos.
- Evento `form_step` no dataLayer a cada avanço de etapa (funil de abandono no GA4).
- Mesmas perguntas, mesmos valores, mesmo payload ao RD Station — nada muda no CRM.

## Modo prévia (automático)

Fora do domínio `lan4.com.br`, a página entra em modo prévia:
- **GTM não carrega** (nenhum evento vai para GA4/Ads/Meta).
- **Envio ao RD Station é simulado** (nenhum lead de teste é criado).
- Selo roxo "Prévia de validação" fica visível.

No domínio real, tudo funciona normalmente — os arquivos já são os de produção.

## Deploy em produção (após aprovação)

Subir ao cPanel apenas:
1. `index.html` (raiz)
2. `js/main.js`

Os demais arquivos (css/, img/, video/, fonts/) já existem no servidor e não mudaram — estão aqui só para a prévia renderizar fiel. Após o deploy, importar o container GTM v3 (`gtm-lan4-v3-import-form-steps-scroll-2026-07-21.json`, na pasta de tracking do projeto) com a opção **Mesclar**.
