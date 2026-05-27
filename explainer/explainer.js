(function () {
  "use strict";

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── Scroll-fade (Intersection Observer) ───────────────────────────────────

  var fadeEls = document.querySelectorAll(".fade-in");
  if ("IntersectionObserver" in window) {
    var fadeObs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            fadeObs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.05 }
    );
    fadeEls.forEach(function (el) { fadeObs.observe(el); });
  } else {
    fadeEls.forEach(function (el) { el.classList.add("visible"); });
  }

  // ── Animate diagram panels when visible ───────────────────────────────────

  var panels = document.querySelectorAll(".diagram-panel");
  if ("IntersectionObserver" in window) {
    var panelObs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("animate");
            panelObs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.3 }
    );
    panels.forEach(function (p) { panelObs.observe(p); });
  } else {
    panels.forEach(function (p) { p.classList.add("animate"); });
  }

  // ── Hierarchy tree: hover/focus ancestry highlighting ─────────────────────

  var treeNodes = document.querySelectorAll(".tree-node-group");
  var treeEdges = document.querySelectorAll(".tree-edge");

  function highlightAncestry(tag) {
    var node = document.querySelector('.tree-node-group[data-tag="' + tag + '"]');
    if (!node) return;
    var ancestors = node.dataset.ancestors ? node.dataset.ancestors.split(",") : [];
    var chain = ancestors.concat([tag]);

    treeNodes.forEach(function (n) {
      if (chain.indexOf(n.dataset.tag) !== -1) {
        n.classList.add("highlighted");
        n.classList.remove("dimmed");
      } else {
        n.classList.add("dimmed");
        n.classList.remove("highlighted");
      }
    });

    treeEdges.forEach(function (edge) {
      var from = edge.dataset.from;
      var to = edge.dataset.to;
      if (chain.indexOf(from) !== -1 && chain.indexOf(to) !== -1) {
        edge.classList.add("highlighted");
        edge.classList.remove("dimmed");
      } else {
        edge.classList.add("dimmed");
        edge.classList.remove("highlighted");
      }
    });
  }

  function clearTreeHighlight() {
    treeNodes.forEach(function (n) {
      n.classList.remove("highlighted", "dimmed");
    });
    treeEdges.forEach(function (e) {
      e.classList.remove("highlighted", "dimmed");
    });
  }

  treeNodes.forEach(function (node) {
    node.addEventListener("mouseenter", function () {
      if (!activeScopeBtn) highlightAncestry(node.dataset.tag);
    });
    node.addEventListener("focus", function () {
      if (!activeScopeBtn) highlightAncestry(node.dataset.tag);
    });
    node.addEventListener("mouseleave", function () {
      if (!activeScopeBtn) clearTreeHighlight();
    });
    node.addEventListener("blur", function () {
      if (!activeScopeBtn) clearTreeHighlight();
    });
  });

  // ── Scope selector demo ───────────────────────────────────────────────────

  var scopeBtns = document.querySelectorAll(".scope-btn:not(.corridor-btn)");
  var scopeCaption = document.getElementById("scope-caption");
  var activeScopeBtn = null;

  var scopeDescriptions = {
    sea: "Scoped to <code>sea</code> — only Seattle-area repeaters forward this message.",
    "w-wa": "Scoped to <code>w-wa</code> — all Western Washington repeaters forward this message.",
    wa: "Scoped to <code>wa</code> — every Washington State repeater forwards this message.",
    pnw: "Scoped to <code>pnw</code> — the entire Pacific Northwest hears this message.",
    west: "Scoped to <code>west</code> — every repeater in the mesh forwards this message."
  };

  function applyScope(scope) {
    treeNodes.forEach(function (n) {
      var tags = n.dataset.ancestors ? n.dataset.ancestors.split(",").concat([n.dataset.tag]) : [n.dataset.tag];
      if (tags.indexOf(scope) !== -1) {
        n.classList.add("highlighted");
        n.classList.remove("dimmed");
      } else {
        n.classList.add("dimmed");
        n.classList.remove("highlighted");
      }
    });

    treeEdges.forEach(function (edge) {
      var fromNode = document.querySelector('.tree-node-group[data-tag="' + edge.dataset.from + '"]');
      var toNode = document.querySelector('.tree-node-group[data-tag="' + edge.dataset.to + '"]');
      if (fromNode && toNode && fromNode.classList.contains("highlighted") && toNode.classList.contains("highlighted")) {
        edge.classList.add("highlighted");
        edge.classList.remove("dimmed");
      } else {
        edge.classList.add("dimmed");
        edge.classList.remove("highlighted");
      }
    });

    scopeCaption.innerHTML = scopeDescriptions[scope] || "";
  }

  scopeBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var scope = btn.dataset.scope;
      if (activeScopeBtn === btn) {
        btn.classList.remove("active");
        activeScopeBtn = null;
        clearTreeHighlight();
        scopeCaption.textContent = "Click a scope above to see which repeaters forward that message.";
        return;
      }
      scopeBtns.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      activeScopeBtn = btn;
      applyScope(scope);
    });
  });

  // ── Corridor flow demo (bidirectional from Seattle) ────────────────────────

  var corridorBtns = document.querySelectorAll(".corridor-btn");
  var corridorNodes = document.querySelectorAll(".corridor-node-circle");
  var corridorLinks = document.querySelectorAll(".corridor-link");
  var corridorStatuses = document.querySelectorAll(".corridor-status");
  var corridorCaption = document.getElementById("corridor-caption");
  var activeCorridorBtn = null;
  var pulseTimer = null;
  var ORIGIN = 4;

  var corridorDescriptions = {
    sea: "Scoped to <code>sea</code> — only Seattle carries this tag. The message stays local.",
    wa: "Scoped to <code>wa</code> — the message expands south to Kelso and north to Bellingham, then stops at the Oregon and Canadian borders.",
    or: "Scoped to <code>or</code> — only Oregon repeaters carry <code>or</code>. Portland, Salem, and Eugene are in scope. Washington and BC never see the message.",
    bc: "Scoped to <code>bc</code> — only BC repeaters carry <code>bc</code>. Vancouver and Victoria are in scope. Washington and Oregon never see the message.",
    pnw: "Scoped to <code>pnw</code> — every repeater carries <code>pnw</code>, so the message travels the full length of the corridor."
  };

  function resetCorridor() {
    if (pulseTimer) { clearTimeout(pulseTimer); pulseTimer = null; }
    corridorNodes.forEach(function (n) {
      n.classList.remove("active", "stopped", "inactive");
      n.setAttribute("fill", "#aaa");
      n.setAttribute("r", "16");
    });
    corridorLinks.forEach(function (l) { l.classList.remove("active"); });
    corridorStatuses.forEach(function (s) {
      s.classList.remove("show", "forward", "stops");
      s.textContent = "";
    });
  }

  function markNode(i, type, label) {
    var n = corridorNodes[i];
    var s = corridorStatuses[i];
    if (type === "send") {
      n.classList.add("active"); n.setAttribute("fill", "#2d6a4f"); n.setAttribute("r", "18");
      s.textContent = label || "SEND"; s.classList.add("show", "forward");
    } else if (type === "forward") {
      n.classList.add("active"); n.setAttribute("fill", "#2d6a4f"); n.setAttribute("r", "18");
      s.textContent = label || "FORWARD"; s.classList.add("show", "forward");
    } else if (type === "stopped") {
      n.classList.add("stopped"); n.setAttribute("fill", "#e07a5f"); n.setAttribute("r", "18");
      s.textContent = label || "STOPS"; s.classList.add("show", "stops");
    } else {
      n.classList.add("inactive"); n.setAttribute("fill", "#ddd");
    }
  }

  function findDemoOrigin(matches) {
    var best = -1;
    var bestDist = Infinity;
    for (var i = 0; i < matches.length; i++) {
      if (matches[i]) {
        var dist = Math.abs(i - ORIGIN);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      }
    }
    return best;
  }

  function applyStaticCorridor(matches) {
    var nodeArr = Array.from(corridorNodes);
    var linkArr = Array.from(corridorLinks);
    nodeArr.forEach(function (n, i) {
      if (matches[i]) {
        markNode(i, "forward", "IN SCOPE");
      } else if (
        (i > 0 && matches[i - 1]) ||
        (i < matches.length - 1 && matches[i + 1])
      ) {
        markNode(i, "stopped");
      } else {
        markNode(i, "inactive");
      }
    });
    linkArr.forEach(function (l, i) {
      if (matches[i] && matches[i + 1]) l.classList.add("active");
    });
  }

  function runCorridor(scope) {
    resetCorridor();
    var nodeArr = Array.from(corridorNodes);
    var linkArr = Array.from(corridorLinks);
    var delay = reducedMotion ? 0 : 350;

    var matches = nodeArr.map(function (n) {
      var tags = n.dataset.tags ? n.dataset.tags.split(",") : [];
      return tags.indexOf(scope) !== -1;
    });

    var origin = matches[ORIGIN] ? ORIGIN : findDemoOrigin(matches);
    if (origin < 0) {
      corridorCaption.innerHTML = corridorDescriptions[scope] || "";
      return;
    }

    if (reducedMotion) {
      applyStaticCorridor(matches);
      corridorCaption.innerHTML = corridorDescriptions[scope] || "";
      return;
    }

    markNode(origin, "send");

    var leftQueue = [];
    for (var i = origin - 1; i >= 0; i--) leftQueue.push(i);
    var rightQueue = [];
    for (var i = origin + 1; i < nodeArr.length; i++) rightQueue.push(i);

    var leftStopped = false;
    var rightStopped = false;
    var stepNum = 0;

    function step() {
      var li = stepNum < leftQueue.length ? leftQueue[stepNum] : -1;
      var ri = stepNum < rightQueue.length ? rightQueue[stepNum] : -1;

      if (li >= 0 && !leftStopped) {
        if (matches[li]) {
          markNode(li, "forward");
          linkArr[li].classList.add("active");
        } else {
          markNode(li, "stopped");
          leftStopped = true;
          for (var j = stepNum + 1; j < leftQueue.length; j++) markNode(leftQueue[j], "inactive");
        }
      }

      if (ri >= 0 && !rightStopped) {
        if (matches[ri]) {
          markNode(ri, "forward");
          linkArr[ri - 1].classList.add("active");
        } else {
          markNode(ri, "stopped");
          rightStopped = true;
          for (var j = stepNum + 1; j < rightQueue.length; j++) markNode(rightQueue[j], "inactive");
        }
      }

      stepNum++;
      var moreLeft = !leftStopped && stepNum < leftQueue.length;
      var moreRight = !rightStopped && stepNum < rightQueue.length;
      if (moreLeft || moreRight) {
        pulseTimer = setTimeout(step, delay);
      }
    }

    pulseTimer = setTimeout(step, delay);
    corridorCaption.innerHTML = corridorDescriptions[scope] || "";
  }

  corridorBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var scope = btn.dataset.scope;
      if (activeCorridorBtn === btn) {
        btn.classList.remove("active");
        activeCorridorBtn = null;
        resetCorridor();
        corridorCaption.textContent = "Select a scope above to see which repeaters forward that message.";
        return;
      }
      corridorBtns.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      activeCorridorBtn = btn;
      runCorridor(scope);
    });
  });

  // ── Config: tool link gating ──────────────────────────────────────────────

  var CONFIG = {
    showToolLinks: true,
    basePath: ".."
  };

  if (!CONFIG.showToolLinks) {
    var ctaSection = document.getElementById("get-started");
    if (ctaSection) ctaSection.style.display = "none";
  }
})();
