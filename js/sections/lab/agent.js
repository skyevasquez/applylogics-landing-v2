/* Exhibit B — a scripted support inbox. Every reply here is written in advance;
   nothing is sent to a model. The point is to show the shape of the work:
   read → classify → look up → reply, and knowing when to hand off. */
import { gsap, motion } from "../../core/env.js";
import { onActive, onFirstView, pad2 } from "./util.js";

const SAMPLES = [
  {
    channel: "Web chat",
    text: "Hi, are you open this Saturday? What time do you close?",
    intent: "Opening hours",
    source: "Business hours",
    reply: "Hi! Yes, we're open this Saturday from 9 am to 4 pm. Want me to set anything aside before you come in?",
  },
  {
    channel: "Email",
    text: "Where's my order? I placed it on Monday and haven't heard anything.",
    intent: "Order status",
    source: "Order record",
    reply: "Thanks for checking in. Your order from Monday was packed yesterday and is out for delivery today. I've just emailed you the tracking link.",
  },
  {
    channel: "Text message",
    text: "Can I move my appointment to Thursday afternoon instead?",
    intent: "Reschedule",
    source: "Calendar",
    reply: "Done. Thursday at 2:30 pm was free, so I've moved your appointment there and sent you a new confirmation.",
  },
  {
    channel: "Email",
    text: "I was charged TWICE and nobody is answering me. I want my money back today.",
    intent: "Billing dispute · upset",
    source: "Payment history",
    human: "Money and an upset customer. The agent doesn't guess on refunds.",
    reply: "I'm sorry, that shouldn't have happened. I can see both charges, so I've passed this straight to a person on our team with everything attached. You won't have to explain it twice.",
  },
  {
    channel: "Web chat",
    text: "Do you do pricing for a team of twelve? Looking for a quote.",
    intent: "Sales enquiry",
    source: "Price list",
    reply: "We do. I've sent our team pricing to your email and passed your details along, so someone can call you about the specifics.",
  },
];

/* Keyword rules for visitor-written messages. Order matters: anything that
   smells like money, anger or a request for a person goes to a human first. */
const RULES = [
  {
    test: /\b(refund|charged|chargeback|money back|overcharg\w*|lawyer|legal|sue|complain\w*|angry|furious|terrible|awful|worst|unacceptable|manager|human|real person|scam|fraud)\b/i,
    intent: "Complaint or billing",
    source: "Account history",
    human: "Money or an unhappy customer. That gets a person, every time.",
    reply: "I'm sorry about this. I've passed your message straight to a person on our team with your account details attached, so you won't have to explain it twice.",
  },
  {
    test: /\b(open|opening|close|closing|closed|hours?|saturday|sunday|weekend|holiday)\b/i,
    intent: "Opening hours",
    source: "Business hours",
    reply: "We're open Monday to Friday from 9 am to 6 pm, and Saturday from 9 am to 4 pm. Anything I can get ready for you?",
  },
  {
    test: /\b(order\w*|deliver\w*|shipping|shipped|track\w*|package|parcel|arrive\w*)\b/i,
    intent: "Order status",
    source: "Order record",
    reply: "I've found your most recent order. It's on its way, and I've sent the tracking link to your email.",
  },
  {
    test: /\b(appointment|book\w*|reschedul\w*|schedul\w*|slot|availability|available)\b/i,
    intent: "Scheduling",
    source: "Calendar",
    reply: "I've found the next open slot and sent you a link to confirm it, or to pick a different time if that one doesn't suit.",
  },
  {
    test: /\b(price\w*|pricing|quote|cost\w*|how much|rates?|estimate)\b/i,
    intent: "Sales enquiry",
    source: "Price list",
    reply: "I've sent our current pricing to your email. I've also flagged this so someone can follow up with a quote that fits.",
  },
];
const UNSURE = {
  intent: "Unclear",
  source: "No confident match",
  human: "The agent wasn't sure what was being asked, so it didn't improvise.",
  reply: "I want to get this right, so rather than guess I've passed your message to a person on our team. They'll reply to you directly.",
};

function classify(text) {
  const shouting = text.replace(/[^A-Z]/g, "").length > 12 || /!{2,}/.test(text);
  const rule = RULES.find((r) => r.test.test(text)) || (shouting ? RULES[0] : null) || UNSURE;
  return { channel: "Web chat · you", text, intent: rule.intent, source: rule.source, reply: rule.reply, human: rule.human };
}

export function initAgent(root) {
  const box = root.querySelector("[data-agt]");
  if (!box) return;
  const q = (s) => root.querySelector(s);
  const list = q("[data-agt-list]");
  const form = q("[data-agt-form]");
  const input = form.querySelector("input");
  const steps = Array.from(q("[data-agt-steps]").children);
  const stepLabel = q("[data-step-label]");
  const thread = q("[data-agt-thread]");
  const inBubble = q("[data-agt-in]");
  const channel = q("[data-agt-channel]");
  const outRow = q("[data-agt-out-row]");
  const typed = q("[data-agt-typed]");
  const outcome = q("[data-agt-outcome]");
  const outcomeText = outcome.querySelector("span");
  const live = q("[data-agt-live]");
  const out = { auto: q("[data-agt-auto]"), human: q("[data-agt-human]"), total: q("[data-agt-total]"), waiting: q("[data-agt-waiting]") };

  const counts = { auto: 0, human: 0 };
  let tl = null;
  let customs = 0;

  /* --- inbox --- */
  function addItem(msg, { prepend = false } = {}) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ex-agt-msg";
    btn.innerHTML =
      '<i class="ex-agt-led" aria-hidden="true"></i>' +
      '<span class="ex-agt-from t-mono"><span></span><b></b></span>' +
      '<span class="ex-agt-txt"></span>';
    btn.querySelector(".ex-agt-from span").textContent = msg.channel;
    btn.querySelector(".ex-agt-txt").textContent = msg.text;
    btn.addEventListener("click", () => run(msg, btn));
    li.appendChild(btn);
    if (prepend) list.prepend(li);
    else list.appendChild(li);
    return btn;
  }
  function refreshWaiting() {
    const n = list.querySelectorAll(".ex-agt-msg:not([data-done])").length;
    out.waiting.textContent = n ? n + " waiting" : "Inbox clear";
  }
  SAMPLES.forEach((m) => addItem(m));
  refreshWaiting();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim().slice(0, 140);
    if (!text) return input.focus();
    input.value = "";
    if (customs >= 2) {
      const old = list.querySelector("[data-custom]");
      if (old) old.closest("li").remove();
    } else customs++;
    const msg = classify(text);
    const btn = addItem(msg, { prepend: true });
    btn.dataset.custom = "";
    refreshWaiting();
    run(msg, btn);
  });

  /* --- pipeline --- */
  function reset() {
    steps.forEach((li, i) => {
      li.classList.remove("is-on", "is-done", "is-human");
      li.querySelector("[data-note]").textContent = i ? "—" : "Waiting";
    });
    stepLabel.textContent = "Reply";
    thread.classList.remove("is-human", "is-typing");
    outRow.classList.remove("is-on");
    outcome.classList.remove("is-on");
    inBubble.classList.remove("is-reading");
    typed.textContent = "";
    outcomeText.textContent = "";
  }

  function finish(msg, btn) {
    const kind = msg.human ? "human" : "auto";
    if (btn && !btn.dataset.done) {
      counts[kind]++;
      btn.dataset.done = kind;
      btn.querySelector(".ex-agt-from b").textContent = msg.human ? "→ Human" : "✓ Handled";
    }
    out.auto.textContent = pad2(counts.auto);
    out.human.textContent = pad2(counts.human);
    const total = counts.auto + counts.human;
    out.total.textContent = total + (total === 1 ? " message" : " messages");
    refreshWaiting();
    outcomeText.innerHTML = msg.human
      ? "<b>Routed to a human.</b> "
      : "<b>Handled automatically.</b> No one had to stop what they were doing.";
    if (msg.human) outcomeText.appendChild(document.createTextNode(msg.human));
    outcome.classList.add("is-on");
    live.textContent =
      "Agent reply: " + msg.reply + " " + (msg.human ? "Routed to a human. " + msg.human : "Handled automatically.");
  }

  function run(msg, btn) {
    if (tl) tl.kill();
    reset();
    list.querySelectorAll(".is-active").forEach((b) => b.classList.remove("is-active"));
    if (btn) btn.classList.add("is-active");
    channel.textContent = "Customer · " + msg.channel.replace(" · you", "");
    inBubble.textContent = msg.text;
    live.textContent = "";

    const notes = [msg.channel.replace(" · you", ""), msg.intent, msg.source, msg.human ? "Summary attached" : "Sent"];
    const typeDur = Math.min(2.6, msg.reply.length * 0.017);
    const durs = [0.7, 0.75, 0.85, typeDur];

    const enter = (i) => {
      const li = steps[i];
      li.style.setProperty("--d", durs[i] + "s");
      if (i === 3 && msg.human) {
        stepLabel.textContent = "Hand off";
        thread.classList.add("is-human");
      }
      if (msg.human && i >= 1) li.classList.add("is-human");
      li.classList.add("is-on");
      li.querySelector("[data-note]").textContent = i === 0 ? "Reading…" : i === 3 ? "Writing…" : "…";
    };
    const leave = (i) => {
      const li = steps[i];
      li.classList.remove("is-on");
      li.classList.add("is-done");
      li.querySelector("[data-note]").textContent = notes[i];
    };

    if (!motion) {
      steps.forEach((_, i) => {
        enter(i);
        leave(i);
      });
      outRow.classList.add("is-on");
      typed.textContent = msg.reply;
      finish(msg, btn);
      return;
    }

    const count = { n: 0 };
    tl = gsap.timeline({ paused: !isActive() });
    tl.fromTo(inBubble, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" })
      .call(() => {
        enter(0);
        inBubble.classList.add("is-reading");
      })
      .to({}, { duration: durs[0] })
      .call(() => {
        leave(0);
        inBubble.classList.remove("is-reading");
        enter(1);
      })
      .to({}, { duration: durs[1] })
      .call(() => {
        leave(1);
        enter(2);
      })
      .to({}, { duration: durs[2] })
      .call(() => {
        leave(2);
        enter(3);
        outRow.classList.add("is-on");
        thread.classList.add("is-typing");
      })
      .fromTo(outRow, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" })
      .to(
        count,
        {
          n: msg.reply.length,
          duration: typeDur,
          ease: "none",
          onUpdate: () => (typed.textContent = msg.reply.slice(0, Math.round(count.n))),
        },
        "<"
      )
      .call(() => {
        typed.textContent = msg.reply;
        thread.classList.remove("is-typing");
        leave(3);
        finish(msg, btn);
      })
      .fromTo(outcome, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "none" });
  }

  const isActive = onActive(box, (on) => {
    if (!tl) return;
    if (on) tl.resume();
    else tl.pause();
  });

  /* play one message the first time the exhibit is seen */
  onFirstView(box, () => {
    if (tl || counts.auto + counts.human) return;
    const first = list.querySelectorAll(".ex-agt-msg")[1];
    if (first) run(SAMPLES[1], first);
  });
}
