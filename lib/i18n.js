// i18n.js — Portuguese / English. Choice is saved in localStorage (shared by popup and
// options, same extension origin) and mirrored to chrome.storage for the background worker.
// Default: the browser's language.

const KEY = "deskbee-lang";

const plural = (n, one, many) => (n === 1 ? one : many);

export const LANG_NAMES = { pt: "Português", en: "English" };

export const dictionaries = {
  en: {
    weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],

    // tabs / panes
    tab_list: "My Reserves",
    tab_new: "New Booking",
    pane_list: "My reserves",
    pane_new: "New booking",

    // list
    all: "All",
    filter: "Filter…",
    cancel_selected: ({ n }) => `Cancel selected (${n})`,
    edit_selected: ({ n }) => `Edit selected (${n})`,
    edit_this: "Edit this reserve",
    edit_x: ({ x }) => `Edit ${x}`,
    edit_title_one: "Edit reserve",
    edit_title_n: ({ n }) => `Edit ${n} reserves`,
    edit_start: "Check-in",
    edit_end: "Check-out",
    edit_desk: "Desk",
    edit_keep: "keep",
    edit_batch_hint: "Empty fields keep each reserve's current value.",
    review: "Review",
    edit_n_question: ({ n }) => `Edit ${n} ${plural(n, "reserve", "reserves")}?`,
    edit_emails_notice:
      "Deskbee edits by canceling and recreating, so each edit sends a cancellation and a new-booking email.",
    tag_edit: "edit",
    "tag_skip-status": "not editable",
    "tag_skip-no-desk": "desk not found",
    "tag_skip-range": "end before start",
    "tag_skip-unchanged": "no change",
    editing_progress: ({ done, total }) => `Editing ${done}/${total}`,
    n_edited: ({ n }) => `${n} edited.`,
    from: "From",
    to: "To",
    desk: "Desk",
    any: "any",
    select_matching: "Select matching",
    loading: "Loading…",
    no_reserves: "No active reserves found.",
    unknown_desk: "Unknown desk",
    desk_n: ({ n }) => `Desk ${n}`,
    select_x: ({ x }) => `Select ${x}`,
    cancel_x: ({ x }) => `Cancel ${x}`,
    cancel_this: "Cancel this reserve",
    cancel_confirm_short: "Cancel?",
    cancel_n_question: ({ n }) => `Cancel ${n} ${plural(n, "reserve", "reserves")}?`,
    yes_cancel: "Yes, cancel",
    back: "Back",
    n_selected_hint: ({ n }) =>
      `${n} ${plural(n, "reserve", "reserves")} selected. Review and adjust before canceling.`,
    label_desk: ({ day, desk }) => `${day} · desk ${desk}`,

    // statuses returned by the API
    status_reserved: "Reserved",
    status_pending: "Pending",
    status_confirmed: "Confirmed",
    status_checkin: "Checked in",

    // new booking
    no_preset: "No preset",
    delete: "Delete",
    secondary_desks: "Secondary desks (optional)",
    eg_desk: "e.g. 308",
    eg_secondary: "e.g. 309, 310",
    start_date: "Start date",
    end_date: "End date",
    days_of_week: "Days of week",
    time: "Time",
    default: "Default",
    default_checkin: "Default check-in",
    default_checkout: "Default check-out",
    different_time: "Different time for a day",
    day_with_different_time: "Day with a different time",
    checkin_of: ({ day }) => `${day} check-in`,
    checkout_of: ({ day }) => `${day} check-out`,
    remove_time_of: ({ day }) => `Remove ${day} time`,
    remove: "Remove",
    skip_booked: "Skip days I already booked",
    preview: "Preview",
    preset_name: "Preset name",
    save_preset: "Save preset",

    // desk lookup
    floor_unknown: "Floor unknown: set it in Options, or open your floor map in Deskbee once.",
    loading_map: "Loading map… please wait.",
    enter_desk: "Enter a desk number from the map.",
    desk_not_found: ({ desk }) => `✗ Desk ${desk} not found on this floor`,
    desk_found: "✓ Desk found",
    desk_found_but: ({ list }) => `✓ Desk found · ✗ not on this floor: ${list}`,

    // schedule errors
    "sched_default-range": "Default time: check-out must be after check-in.",
    sched_range: ({ day }) => `${day}: check-out must be after check-in.`,
    sched_duplicate: ({ day }) => `${day} has more than one different time.`,
    sched_unselected: ({ day }) => `${day} is not one of the selected days.`,

    // preview
    pick_desk: "Pick a desk that exists on this floor.",
    pick_weekday: "Please select at least one day of the week.",
    end_after_start: "End date must be after start date.",
    building_preview: "Building preview…",
    n_bookings: ({ n }) => `${n} ${plural(n, "booking", "bookings")}`,
    desk_lower: "desk",
    tag_book: "book",
    "tag_skip-booked": "already booked",
    "tag_skip-past": "past",
    "tag_skip-too-far": "too far",
    too_far_reason: ({ n }) => `more than ${n} days ahead`,
    no_days: "No days in this range.",
    confirm: "Confirm",

    // jobs
    could_not_start: "Could not start the batch.",
    job_busy: "Another batch is still running.",
    job_empty: "Nothing to do.",
    booking_progress: ({ done, total }) => `Booking ${done}/${total}`,
    canceling_progress: ({ done, total }) => `Canceling ${done}/${total}`,
    can_close: "You can close this window; the batch keeps running.",
    n_booked: ({ n }) => `${n} booked.`,
    n_canceled: ({ n }) => `${n} canceled.`,
    failed_n: ({ n }) => `Failed: ${n}`,
    job_interrupted: "Batch was interrupted. Check your reserves.",
    job_session_expired: "Session expired. Open Deskbee, log in again and retry.",

    // session / setup
    checking_session: "Checking session…",
    session_expired_short: "Your session has expired. Please log in again.",
    company_not_detected_title: "Company not detected.",
    company_not_detected_body:
      "Open your company's Deskbee (<code>&lt;company&gt;.deskbee.app</code>) and log in, or set it in the Options page.",
    session_expired_title: "Session expired.",
    session_expired_body: ({ link }) =>
      `Log in to ${link} once; the extension picks up the new session automatically.`,
    floor_set: "floor set",
    session_left: ({ d, h }) => `session ${d ? `${d}d ` : ""}${h}h`,
    session_ended: "session expired",

    // footer / header controls
    open_window: "Open in a separate window",
    switch_theme: "Switch light / dark theme",
    language: "Language",

    // updates
    update_available: ({ v }) => `Version ${v} is available`,
    update_download: "Download",
    update_dismiss: "Dismiss",
    update_how: "Unzip it over the same folder, then click ↻ in chrome://extensions.",
    opt_updates: "Updates",
    opt_installed_latest: ({ cur, latest }) => `Installed ${cur} · Latest ${latest}`,
    opt_latest_unknown: "unknown",
    opt_check_updates: "Check for updates",
    opt_checking: "Checking…",
    opt_up_to_date: "You're on the latest version.",
    "opt_update_not_found": "No release found yet (the repository may be private or have no releases).",
    "opt_update_network": "Couldn't reach GitHub. Try again later.",

    // options page
    opt_title: "Deskbee Helper Settings",
    opt_hint:
      "Detected automatically when you use your company's Deskbee (<code>&lt;company&gt;.deskbee.app</code>). Only fill these in if detection got something wrong; leave a field blank to use the detected value.",
    opt_account: "Company account (subdomain)",
    opt_floor: "Floor UUID",
    opt_version: "App version (x-app-version)",
    opt_rules: "Booking rules",
    opt_advanced: "Advanced",
    opt_max_days: "How many days ahead your company allows booking (0 = no limit)",
    opt_save: "Save settings",
    opt_reset: "Clear overrides and detected data",
    opt_saved: "Settings saved.",
    opt_cleared: "Cleared. Open your Deskbee to detect again.",
    opt_detected: ({ v }) => `detected: ${v}`,
    opt_not_detected: "not detected yet",
    opt_version_n: ({ v }) => `Version ${v}`,
  },

  pt: {
    weekdays: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],

    tab_list: "Minhas reservas",
    tab_new: "Nova reserva",
    pane_list: "Minhas reservas",
    pane_new: "Nova reserva",

    all: "Todas",
    filter: "Filtrar…",
    cancel_selected: ({ n }) => `Cancelar selecionadas (${n})`,
    edit_selected: ({ n }) => `Editar selecionadas (${n})`,
    edit_this: "Editar esta reserva",
    edit_x: ({ x }) => `Editar ${x}`,
    edit_title_one: "Editar reserva",
    edit_title_n: ({ n }) => `Editar ${n} reservas`,
    edit_start: "Entrada",
    edit_end: "Saída",
    edit_desk: "Baia",
    edit_keep: "manter",
    edit_batch_hint: "Campos vazios mantêm o valor atual de cada reserva.",
    review: "Revisar",
    edit_n_question: ({ n }) => `Editar ${n} ${plural(n, "reserva", "reservas")}?`,
    edit_emails_notice:
      "O Deskbee edita cancelando e recriando, então cada edição envia um e-mail de cancelamento e um de nova reserva.",
    tag_edit: "editar",
    "tag_skip-status": "não editável",
    "tag_skip-no-desk": "baia não encontrada",
    "tag_skip-range": "saída antes da entrada",
    "tag_skip-unchanged": "sem mudança",
    editing_progress: ({ done, total }) => `Editando ${done}/${total}`,
    n_edited: ({ n }) => `${n} ${plural(n, "editada", "editadas")}.`,
    from: "De",
    to: "Até",
    desk: "Baia",
    any: "qualquer",
    select_matching: "Selecionar correspondentes",
    loading: "Carregando…",
    no_reserves: "Nenhuma reserva ativa.",
    unknown_desk: "Baia desconhecida",
    desk_n: ({ n }) => `Baia ${n}`,
    select_x: ({ x }) => `Selecionar ${x}`,
    cancel_x: ({ x }) => `Cancelar ${x}`,
    cancel_this: "Cancelar esta reserva",
    cancel_confirm_short: "Cancelar?",
    cancel_n_question: ({ n }) => `Cancelar ${n} ${plural(n, "reserva", "reservas")}?`,
    yes_cancel: "Sim, cancelar",
    back: "Voltar",
    n_selected_hint: ({ n }) =>
      `${n} ${plural(n, "reserva selecionada", "reservas selecionadas")}. Revise e ajuste antes de cancelar.`,
    label_desk: ({ day, desk }) => `${day} · baia ${desk}`,

    status_reserved: "Reservada",
    status_pending: "Pendente",
    status_confirmed: "Confirmada",
    status_checkin: "Check-in feito",

    no_preset: "Sem predefinição",
    delete: "Excluir",
    secondary_desks: "Baias secundárias (opcional)",
    eg_desk: "ex.: 308",
    eg_secondary: "ex.: 309, 310",
    start_date: "Data inicial",
    end_date: "Data final",
    days_of_week: "Dias da semana",
    time: "Horário",
    default: "Padrão",
    default_checkin: "Entrada padrão",
    default_checkout: "Saída padrão",
    different_time: "Horário diferente para um dia",
    day_with_different_time: "Dia com horário diferente",
    checkin_of: ({ day }) => `Entrada de ${day}`,
    checkout_of: ({ day }) => `Saída de ${day}`,
    remove_time_of: ({ day }) => `Remover horário de ${day}`,
    remove: "Remover",
    skip_booked: "Pular dias já reservados",
    preview: "Pré-visualizar",
    preset_name: "Nome da predefinição",
    save_preset: "Salvar predefinição",

    floor_unknown: "Andar desconhecido: defina nas Opções ou abra o mapa do seu andar no Deskbee uma vez.",
    loading_map: "Carregando mapa… aguarde.",
    enter_desk: "Digite o número de uma baia do mapa.",
    desk_not_found: ({ desk }) => `✗ Baia ${desk} não existe neste andar`,
    desk_found: "✓ Baia encontrada",
    desk_found_but: ({ list }) => `✓ Baia encontrada · ✗ fora deste andar: ${list}`,

    "sched_default-range": "Horário padrão: a saída precisa ser depois da entrada.",
    sched_range: ({ day }) => `${day}: a saída precisa ser depois da entrada.`,
    sched_duplicate: ({ day }) => `${day} tem mais de um horário diferente.`,
    sched_unselected: ({ day }) => `${day} não está entre os dias selecionados.`,

    pick_desk: "Escolha uma baia que exista neste andar.",
    pick_weekday: "Selecione pelo menos um dia da semana.",
    end_after_start: "A data final precisa ser depois da inicial.",
    building_preview: "Montando a prévia…",
    n_bookings: ({ n }) => `${n} ${plural(n, "reserva", "reservas")}`,
    desk_lower: "baia",
    tag_book: "reservar",
    "tag_skip-booked": "já reservado",
    "tag_skip-past": "passado",
    "tag_skip-too-far": "muito longe",
    too_far_reason: ({ n }) => `mais de ${n} dias à frente`,
    no_days: "Nenhum dia neste período.",
    confirm: "Confirmar",

    could_not_start: "Não foi possível iniciar o lote.",
    job_busy: "Outro lote ainda está rodando.",
    job_empty: "Nada para fazer.",
    booking_progress: ({ done, total }) => `Reservando ${done}/${total}`,
    canceling_progress: ({ done, total }) => `Cancelando ${done}/${total}`,
    can_close: "Pode fechar esta janela; o lote continua rodando.",
    n_booked: ({ n }) => `${n} ${plural(n, "reservada", "reservadas")}.`,
    n_canceled: ({ n }) => `${n} ${plural(n, "cancelada", "canceladas")}.`,
    failed_n: ({ n }) => `Falharam: ${n}`,
    job_interrupted: "O lote foi interrompido. Confira suas reservas.",
    job_session_expired: "Sessão expirada. Abra o Deskbee, entre de novo e tente outra vez.",

    checking_session: "Verificando sessão…",
    session_expired_short: "Sua sessão expirou. Entre de novo no Deskbee.",
    company_not_detected_title: "Empresa não detectada.",
    company_not_detected_body:
      "Abra o Deskbee da sua empresa (<code>&lt;empresa&gt;.deskbee.app</code>) e entre, ou defina nas Opções.",
    session_expired_title: "Sessão expirada.",
    session_expired_body: ({ link }) =>
      `Entre no ${link} uma vez; a extensão pega a nova sessão automaticamente.`,
    floor_set: "andar definido",
    session_left: ({ d, h }) => `sessão ${d ? `${d}d ` : ""}${h}h`,
    session_ended: "sessão expirada",

    open_window: "Abrir em uma janela separada",
    switch_theme: "Alternar tema claro / escuro",
    language: "Idioma",

    // atualizações
    update_available: ({ v }) => `Versão ${v} disponível`,
    update_download: "Baixar",
    update_dismiss: "Dispensar",
    update_how: "Descompacte por cima da mesma pasta e clique em ↻ em chrome://extensions.",
    opt_updates: "Atualizações",
    opt_installed_latest: ({ cur, latest }) => `Instalada ${cur} · Mais recente ${latest}`,
    opt_latest_unknown: "desconhecida",
    opt_check_updates: "Verificar atualizações",
    opt_checking: "Verificando…",
    opt_up_to_date: "Você está na versão mais recente.",
    "opt_update_not_found": "Nenhuma release encontrada ainda (o repositório pode ser privado ou não ter releases).",
    "opt_update_network": "Não foi possível acessar o GitHub. Tente mais tarde.",

    opt_title: "Configurações do Deskbee Helper",
    opt_hint:
      "Detectados automaticamente quando você usa o Deskbee da sua empresa (<code>&lt;empresa&gt;.deskbee.app</code>). Só preencha se a detecção errar; deixe em branco para usar o valor detectado.",
    opt_account: "Conta da empresa (subdomínio)",
    opt_floor: "UUID do andar",
    opt_version: "Versão do app (x-app-version)",
    opt_rules: "Regras de reserva",
    opt_advanced: "Avançado",
    opt_max_days: "Com quantos dias de antecedência sua empresa permite reservar (0 = sem limite)",
    opt_save: "Salvar configurações",
    opt_reset: "Limpar valores manuais e detectados",
    opt_saved: "Configurações salvas.",
    opt_cleared: "Limpo. Abra o Deskbee para detectar de novo.",
    opt_detected: ({ v }) => `detectado: ${v}`,
    opt_not_detected: "ainda não detectado",
    opt_version_n: ({ v }) => `Versão ${v}`,
  },
};

export function getLang() {
  const saved = globalThis.localStorage?.getItem(KEY);
  if (saved && dictionaries[saved]) return saved;
  return (globalThis.navigator?.language || "").toLowerCase().startsWith("pt") ? "pt" : "en";
}

export function setLang(lang) {
  if (!dictionaries[lang]) return;
  localStorage.setItem(KEY, lang);
  chrome.storage?.local.set({ lang });
}

/** BCP 47 locale for dates, from the chosen language. */
export const locale = () => (getLang() === "pt" ? "pt-BR" : "en-US");

export function t(key, params = {}) {
  const value = dictionaries[getLang()][key] ?? dictionaries.en[key] ?? key;
  return typeof value === "function" ? value(params) : value;
}

export const weekdayName = (day) => t("weekdays")[day];

/** Fill static markup: data-i18n (text), data-i18n-html, data-i18n-placeholder, data-i18n-label (title + aria-label). */
export function applyI18n(root = document) {
  document.documentElement.lang = getLang() === "pt" ? "pt-BR" : "en";
  root.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  root.querySelectorAll("[data-i18n-html]").forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml)));
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => (el.placeholder = t(el.dataset.i18nPlaceholder)));
  root.querySelectorAll("[data-i18n-label]").forEach((el) => {
    el.title = t(el.dataset.i18nLabel);
    el.setAttribute("aria-label", t(el.dataset.i18nLabel));
  });
  root.querySelectorAll(".lang-switch [data-lang]").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.lang === getLang()));
  });
}

/** Wire every .lang-switch on the page; changing language reloads so all text re-renders. */
export function setupLangSwitch() {
  document.querySelectorAll(".lang-switch [data-lang]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.lang === getLang()) return;
      setLang(btn.dataset.lang);
      location.reload();
    });
  });
  // another open page (popup / options / detached window) changed the language
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) location.reload();
  });
}
