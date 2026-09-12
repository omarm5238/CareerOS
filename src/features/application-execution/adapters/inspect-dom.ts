import type { ApplicationFieldType } from "../types";

export type RawInspectedField = {
  externalId: string;
  selector: string;
  label: string;
  type: ApplicationFieldType;
  required: boolean;
  options: Array<{ value: string; label: string }>;
  unsupported: boolean;
  hidden: boolean;
  documentHint: string | null;
  currentValue: string;
};

export type RawPageAction = {
  selector: string;
  label: string;
  type: string;
  insideForm: boolean;
  formHasFields: boolean;
  isSubmitType: boolean;
  dataOpen: boolean;
  dataNext: boolean;
  dataFinal: boolean;
  dataCancel: boolean;
};

export type RawInspectResult = {
  fields: RawInspectedField[];
  actions: RawPageAction[];
  nextSelector: string | null;
  nextLabel: string | null;
  submitSelector: string | null;
  submitLabel: string | null;
  openSelector: string | null;
  openLabel: string | null;
  step: number;
  totalSteps: number | null;
  providerRootFound: boolean;
};

export function inspectDomScript(rootSelector: unknown): RawInspectResult {
  const selector = typeof rootSelector === "string" ? rootSelector : null;
  const root = selector ? document.querySelector(selector) : document;
  if (!root) {
    return {
      fields: [],
      actions: [],
      nextSelector: null,
      nextLabel: null,
      submitSelector: null,
      submitLabel: null,
      openSelector: null,
      openLabel: null,
      step: 1,
      totalSteps: null,
      providerRootFound: false,
    };
  }

  const stepEl = document.querySelector("[data-careeros-step]");
  const step = Number(stepEl?.getAttribute("data-careeros-step") || "1") || 1;
  const total = Number(document.querySelector("[data-careeros-total-steps]")?.getAttribute("data-careeros-total-steps") || "") || null;

  function labelFor(el: Element): string {
    const aria = el.getAttribute("aria-label");
    if (aria) return aria.trim();
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const node = document.getElementById(labelledBy);
      if (node?.textContent) return node.textContent.trim();
    }
    const id = el.getAttribute("id");
    if (id) {
      const viaFor = document.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (viaFor?.textContent) return viaFor.textContent.trim();
    }
    const wrapping = el.closest("label");
    if (wrapping?.textContent) return wrapping.textContent.trim().slice(0, 180);
    const legend = el.closest("fieldset")?.querySelector("legend");
    if (legend?.textContent) return legend.textContent.trim();
    const nearby = el.closest("[data-field-label], .field, .form-group, .application-question")?.querySelector("label, .label, .question, p, span");
    if (nearby?.textContent) return nearby.textContent.trim().slice(0, 180);
    return (el.getAttribute("name") || el.getAttribute("placeholder") || "").trim();
  }

  function cssPath(el: Element): string {
    const testId = el.getAttribute("data-qa") || el.getAttribute("data-test") || el.getAttribute("name") || el.getAttribute("id");
    if (el.getAttribute("data-qa")) return `[data-qa="${el.getAttribute("data-qa")}"]`;
    if (el.getAttribute("data-test")) return `[data-test="${el.getAttribute("data-test")}"]`;
    if (el.id && !el.id.match(/^[a-zA-Z0-9_-]*[0-9]{6,}/)) return `#${CSS.escape(el.id)}`;
    if (el.getAttribute("name")) return `${el.tagName.toLowerCase()}[name="${CSS.escape(el.getAttribute("name")!)}"]`;
    return testId ? `${el.tagName.toLowerCase()}[name="${CSS.escape(testId)}"]` : el.tagName.toLowerCase();
  }

  function mapType(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): ApplicationFieldType {
    if (el.tagName === "SELECT") return "SELECT";
    if (el.tagName === "TEXTAREA") return "TEXTAREA";
    const type = (el as HTMLInputElement).type?.toLowerCase() || "text";
    if (type === "email") return "EMAIL";
    if (type === "tel") return "PHONE";
    if (type === "file") return "FILE";
    if (type === "date") return "DATE";
    if (type === "number") return "NUMBER";
    if (type === "checkbox") return "CHECKBOX";
    if (type === "radio") return "RADIO";
    if (type === "hidden" || type === "submit" || type === "button") return "OTHER";
    return "TEXT";
  }

  const fields: RawInspectedField[] = [];
  const seen = new Set<string>();
  const nodes = root.querySelectorAll("input, select, textarea, [data-careeros-widget]");
  nodes.forEach((node) => {
    const el = node as HTMLInputElement;
    if (el.type === "hidden" || el.type === "submit" || el.type === "button") return;
    if (el.getAttribute("data-careeros-ignore") === "true") return;
    const unsupported = el.getAttribute("data-careeros-widget") === "unsupported";
    const type = unsupported ? "OTHER" : mapType(el as HTMLInputElement);
    const label = unsupported ? el.getAttribute("data-label") || "Custom widget" : labelFor(el);
    const selector = unsupported ? "[data-careeros-widget='unsupported']" : cssPath(el);
    if (seen.has(selector) && type !== "RADIO") return;
    seen.add(selector);
    const options =
      el.tagName === "SELECT"
        ? Array.from((el as unknown as HTMLSelectElement).options).map((option) => ({ value: option.value, label: option.text }))
        : type === "RADIO"
          ? Array.from(root.querySelectorAll(`input[type="radio"][name="${CSS.escape(el.name)}"]`)).map((radio) => ({
              value: (radio as HTMLInputElement).value,
              label: labelFor(radio),
            }))
          : [];
    let currentValue = "";
    if (type === "CHECKBOX" || type === "RADIO") currentValue = el.checked ? el.value || "true" : "";
    else currentValue = el.value || "";
    fields.push({
      externalId: el.getAttribute("name") || el.id || selector,
      selector,
      label,
      type,
      required: el.required || el.getAttribute("aria-required") === "true" || el.getAttribute("data-required") === "true",
      options,
      unsupported,
      hidden: el.type === "hidden",
      documentHint: /resume|cv|cover/i.test(label) ? label : null,
      currentValue,
    });
  });

  const clickable = Array.from(root.querySelectorAll("button, input[type=submit], a, [role=button]"));
  const actions: RawPageAction[] = clickable
    .map((button) => {
      const text = (button.textContent || (button as HTMLInputElement).value || "").trim();
      const form = button.closest("form");
      return {
        selector: button.getAttribute("data-careeros-final-submit") === "true"
          ? "[data-careeros-final-submit='true']"
          : button.getAttribute("data-careeros-open") === "true"
            ? "[data-careeros-open='true']"
            : button.getAttribute("data-careeros-next") === "true"
              ? "[data-careeros-next='true']"
              : cssPath(button),
        label: text.slice(0, 80),
        type: (button as HTMLInputElement).type || button.tagName.toLowerCase(),
        insideForm: Boolean(form),
        formHasFields: Boolean(form && form.querySelectorAll("input, select, textarea").length > 0),
        isSubmitType: (button as HTMLInputElement).type === "submit" || button.getAttribute("type") === "submit",
        dataOpen: button.getAttribute("data-careeros-open") === "true",
        dataNext: button.getAttribute("data-careeros-next") === "true",
        dataFinal: button.getAttribute("data-careeros-final-submit") === "true",
        dataCancel: button.getAttribute("data-careeros-cancel") === "true",
      };
    })
    .filter((item) => item.label);
  let nextSelector: string | null = null;
  let nextLabel: string | null = null;
  let submitSelector: string | null = null;
  let submitLabel: string | null = null;
  let openSelector: string | null = null;
  let openLabel: string | null = null;
  for (const action of actions) {
    if (action.dataFinal || /^submit( application)?$/i.test(action.label) || /submit your application/i.test(action.label)) {
      submitSelector = action.selector;
      submitLabel = action.label || "Submit";
    } else if (action.dataNext || /^(next|continue|save and continue|save & continue)$/i.test(action.label)) {
      nextSelector = action.selector;
      nextLabel = action.label || "Next";
    } else if (action.dataOpen || /^(apply( now| for this job)?|i['’]?m interested)$/i.test(action.label)) {
      openSelector = action.selector;
      openLabel = action.label;
    }
  }

  return {
    fields,
    actions,
    nextSelector,
    nextLabel,
    submitSelector,
    submitLabel,
    openSelector,
    openLabel,
    step,
    totalSteps: total,
    providerRootFound: true,
  };
}

export const inspectDomSource = `function (rootSelector) {
  const selector = typeof rootSelector === "string" ? rootSelector : null;
  const root = selector ? document.querySelector(selector) : document;
  if (!root) {
    return { fields: [], actions: [], nextSelector: null, nextLabel: null, submitSelector: null, submitLabel: null, openSelector: null, openLabel: null, step: 1, totalSteps: null, providerRootFound: false };
  }
  const stepEl = document.querySelector("[data-careeros-step]");
  const step = Number(stepEl && stepEl.getAttribute("data-careeros-step") || "1") || 1;
  const total = Number(document.querySelector("[data-careeros-total-steps]") && document.querySelector("[data-careeros-total-steps]").getAttribute("data-careeros-total-steps") || "") || null;
  function labelFor(el) {
    const aria = el.getAttribute("aria-label");
    if (aria) return aria.trim();
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const node = document.getElementById(labelledBy);
      if (node && node.textContent) return node.textContent.trim();
    }
    const id = el.getAttribute("id");
    if (id) {
      const viaFor = document.querySelector('label[for="' + CSS.escape(id) + '"]');
      if (viaFor && viaFor.textContent) return viaFor.textContent.trim();
    }
    const wrapping = el.closest("label");
    if (wrapping && wrapping.textContent) return wrapping.textContent.trim().slice(0, 180);
    const legend = el.closest("fieldset") && el.closest("fieldset").querySelector("legend");
    if (legend && legend.textContent) return legend.textContent.trim();
    const nearby = el.closest("[data-field-label], .field, .form-group, .application-question");
    const nearbyLabel = nearby && nearby.querySelector("label, .label, .question, p, span");
    if (nearbyLabel && nearbyLabel.textContent) return nearbyLabel.textContent.trim().slice(0, 180);
    return (el.getAttribute("name") || el.getAttribute("placeholder") || "").trim();
  }
  function cssPath(el) {
    if (el.getAttribute("data-qa")) return '[data-qa="' + el.getAttribute("data-qa") + '"]';
    if (el.getAttribute("data-test")) return '[data-test="' + el.getAttribute("data-test") + '"]';
    if (el.id && !el.id.match(/^[a-zA-Z0-9_-]*[0-9]{6,}/)) return "#" + CSS.escape(el.id);
    if (el.getAttribute("name")) return el.tagName.toLowerCase() + '[name="' + CSS.escape(el.getAttribute("name")) + '"]';
    return el.tagName.toLowerCase();
  }
  function mapType(el) {
    if (el.tagName === "SELECT") return "SELECT";
    if (el.tagName === "TEXTAREA") return "TEXTAREA";
    const type = (el.type || "text").toLowerCase();
    if (type === "email") return "EMAIL";
    if (type === "tel") return "PHONE";
    if (type === "file") return "FILE";
    if (type === "date") return "DATE";
    if (type === "number") return "NUMBER";
    if (type === "checkbox") return "CHECKBOX";
    if (type === "radio") return "RADIO";
    if (type === "hidden" || type === "submit" || type === "button") return "OTHER";
    return "TEXT";
  }
  const fields = [];
  const seen = new Set();
  root.querySelectorAll("input, select, textarea, [data-careeros-widget]").forEach((node) => {
    const el = node;
    if (el.type === "hidden" || el.type === "submit" || el.type === "button") return;
    if (el.getAttribute("data-careeros-ignore") === "true") return;
    const unsupported = el.getAttribute("data-careeros-widget") === "unsupported";
    const type = unsupported ? "OTHER" : mapType(el);
    const label = unsupported ? el.getAttribute("data-label") || "Custom widget" : labelFor(el);
    const selectorValue = unsupported ? "[data-careeros-widget='unsupported']" : cssPath(el);
    if (seen.has(selectorValue) && type !== "RADIO") return;
    seen.add(selectorValue);
    const options = el.tagName === "SELECT"
      ? Array.from(el.options).map((option) => ({ value: option.value, label: option.text }))
      : type === "RADIO"
        ? Array.from(root.querySelectorAll('input[type="radio"][name="' + CSS.escape(el.name) + '"]')).map((radio) => ({
            value: radio.value,
            label: labelFor(radio),
          }))
        : [];
    let currentValue = "";
    if (type === "CHECKBOX" || type === "RADIO") currentValue = el.checked ? (el.value || "true") : "";
    else currentValue = el.value || "";
    fields.push({
      externalId: el.getAttribute("name") || el.id || selectorValue,
      selector: selectorValue,
      label: label,
      type: type,
      required: el.required || el.getAttribute("aria-required") === "true" || el.getAttribute("data-required") === "true",
      options: options,
      unsupported: unsupported,
      hidden: el.type === "hidden",
      documentHint: /resume|cv|cover/i.test(label) ? label : null,
      currentValue: currentValue,
    });
  });
  const clickable = Array.from(root.querySelectorAll("button, input[type=submit], a, [role=button]"));
  const actions = clickable.map((button) => {
    const text = (button.textContent || button.value || "").trim();
    const form = button.closest("form");
    let selectorValue = cssPath(button);
    if (button.getAttribute("data-careeros-final-submit") === "true") selectorValue = "[data-careeros-final-submit='true']";
    else if (button.getAttribute("data-careeros-open") === "true") selectorValue = "[data-careeros-open='true']";
    else if (button.getAttribute("data-careeros-next") === "true") selectorValue = "[data-careeros-next='true']";
    return {
      selector: selectorValue,
      label: text.slice(0, 80),
      type: button.type || button.tagName.toLowerCase(),
      insideForm: Boolean(form),
      formHasFields: Boolean(form && form.querySelectorAll("input, select, textarea").length > 0),
      isSubmitType: button.type === "submit" || button.getAttribute("type") === "submit",
      dataOpen: button.getAttribute("data-careeros-open") === "true",
      dataNext: button.getAttribute("data-careeros-next") === "true",
      dataFinal: button.getAttribute("data-careeros-final-submit") === "true",
      dataCancel: button.getAttribute("data-careeros-cancel") === "true",
    };
  }).filter((item) => item.label);
  let nextSelector = null;
  let nextLabel = null;
  let submitSelector = null;
  let submitLabel = null;
  let openSelector = null;
  let openLabel = null;
  for (const action of actions) {
    if (action.dataFinal || /^submit( application)?$/i.test(action.label) || /submit your application/i.test(action.label)) {
      submitSelector = action.selector;
      submitLabel = action.label || "Submit";
    } else if (action.dataNext || /^(next|continue|save and continue|save & continue)$/i.test(action.label)) {
      nextSelector = action.selector;
      nextLabel = action.label || "Next";
    } else if (action.dataOpen || /^(apply( now| for this job)?|i['’]?m interested)$/i.test(action.label)) {
      openSelector = action.selector;
      openLabel = action.label;
    }
  }
  return { fields: fields, actions: actions, nextSelector: nextSelector, nextLabel: nextLabel, submitSelector: submitSelector, submitLabel: submitLabel, openSelector: openSelector, openLabel: openLabel, step: step, totalSteps: total, providerRootFound: true };
}`;
