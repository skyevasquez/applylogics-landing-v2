/* Lab — home section 04. Three working exhibits; each one is independent, so a
   failure in one never takes the others (or the page) down with it. */
import { initResponsive } from "./lab/responsive.js";
import { initAgent } from "./lab/agent.js";
import { initInfra } from "./lab/infra.js";

export function initLab(root = document) {
  const lab = root.querySelector("#lab");
  if (!lab) return;
  const exhibits = {
    responsive: initResponsive,
    agent: initAgent,
    infra: initInfra,
  };
  lab.querySelectorAll("[data-ex]").forEach((el) => {
    const init = exhibits[el.dataset.ex];
    if (!init) return;
    try {
      init(el);
    } catch (err) {
      console.warn("[lab] exhibit failed to start:", el.dataset.ex, err);
    }
  });
}
