/* result.js — Editor de resultado real (Ronda 15)
   Layout tipo CapCut (organizacion), identidad visual Carrete.
   Panel izq/centro: video player real | Panel der: transcripcion editable
   Panel inferior: linea de tiempo 4 barras (video, texto, graficos, audio)
   Doble clic en barra: ver y manipular elementos
*/
(function () {
  var C = window.CARRETE;
  var h = C.h;
  var D = C.data;

  function fmtMs(ms) {
    var s = Math.floor((ms || 0) / 1000);
    var m = Math.floor(s / 60); var ss = s % 60;
    return (m < 10 ? "0" : "") + m + ":" + (ss < 10 ? "0" : "") + ss;
  }
  function fmtSec(sec) {
    var s = Math.floor(sec || 0);
    var m = Math.floor(s / 60); var ss = s % 60;
    return (m < 10 ? "0" : "") + m + ":" + (ss < 10 ? "0" : "") + ss;
  }

  /* ── VIDEO PLAYER ── */
  function VideoPlayer() {
    var s = C.state;
    var url = s.editorVideoUrl;
    if (!url) {
      return h("div", { class: "ed-stage" },
        h("div", { class: "ed-stage__placeholder" },
          h("span", { style: "font-size:48px" }, "\u{1F3AC}"),
          h("p", { class: "ed-stage__hint" }, "El video aparece aqui tras generar")
        )
      );
    }
    return h("div", { class: "ed-stage" },
      h("video", {
        class: "ed-video", src: url, controls: true, playsinline: true,
        style: "width:100%;height:100%;object-fit:contain;border-radius:8px;background:#0a0a0a"
      })
    );
  }

  /* ── TRANSCRIPCION (panel derecho) ── */
  function TranscriptPanel() {
    var s = C.state;
    var words = s.editorTranscript;

    if (s.renderId && !s.editorData && words.length === 0) {
      return h("div", { class: "ed-transcript" },
        h("div", { class: "ed-transcript__head" }, "TRANSCRIPCION"),
        h("div", { class: "ed-transcript__loading" }, "Cargando transcripcion...")
      );
    }
    if (!words || words.length === 0) {
      return h("div", { class: "ed-transcript" },
        h("div", { class: "ed-transcript__head" }, "TRANSCRIPCION"),
        h("div", { class: "ed-transcript__empty" },
          h("p", null, "Disponible en el proximo render."),
          h("p", { style: "font-size:12px;color:#888;margin-top:8px" }, "El pipeline guarda la transcripcion completa para su edicion aqui.")
        )
      );
    }

    // Agrupar en frases por pausa > 1s
    var phrases = []; var cur = [];
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (cur.length > 0) {
        var prev = cur[cur.length - 1];
        if ((Number(w.start) - Number(prev.end)) > 1.0) { phrases.push(cur); cur = []; }
      }
      cur.push(w);
    }
    if (cur.length > 0) phrases.push(cur);
    var removedCount = words.filter(function(w) { return w.removed; }).length;

    return h("div", { class: "ed-transcript" },
      h("div", { class: "ed-transcript__head" },
        "TRANSCRIPCION",
        removedCount > 0
          ? h("span", { class: "ed-transcript__badge" }, removedCount + " eliminadas")
          : null
      ),
      h("div", { class: "ed-transcript__scroll" },
        phrases.map(function(phrase, pi) {
          var startSec = Number(phrase[0].start);
          return h("div", { class: "ed-phrase" },
            h("span", { class: "ed-phrase__time" }, fmtSec(startSec)),
            h("span", { class: "ed-phrase__words" },
              phrase.map(function(w) {
                var removed = w.removed;
                var wordIdx = words.indexOf(w);
                return h("span", {
                  class: "ed-word" + (removed ? " ed-word--removed" : ""),
                  title: removed ? "Eliminado — clic para restaurar" : ("t=" + fmtSec(w.start)),
                  contentEditable: removed ? "false" : "true",
                  suppressContentEditableWarning: true,
                  onClick: removed
                    ? function() {
                        var wi = words.indexOf(w);
                        if (wi >= 0) {
                          var updated = words.slice();
                          updated[wi] = Object.assign({}, w, { removed: false });
                          C.setState({ editorTranscript: updated });
                        }
                      }
                    : function() {
                        var vid = document.querySelector(".ed-video");
                        if (vid) { vid.currentTime = Number(w.start); }
                      },
                  onBlur: removed ? undefined : function(e) {
                    var wi = words.indexOf(w);
                    if (wi >= 0) {
                      var updated = words.slice();
                      updated[wi] = Object.assign({}, w, { word: e.target.textContent || w.word });
                      C.state.editorTranscript = updated;
                    }
                  },
                }, w.word);
              })
            )
          );
        })
      ),
      h("div", { class: "ed-transcript__legend" },
        h("span", { class: "ed-leg" }, "\u25A0 Normal"),
        h("span", { class: "ed-leg ed-leg--red" }, "\u25A0 Eliminado (clic=restaurar)")
      )
    );
  }

  /* ── SEGMENTOS POR PISTA ── */
  function getTrackSegs(trackId, s, totalSec) {
    var scenes = s.editorScenes || [];
    if (trackId === "graficos" && scenes.length > 0) {
      return scenes.map(function(sc) {
        var pct = (sc.timestamp_ms / 1000 / totalSec) * 100;
        return { pct: pct, wPct: 9, label: (sc.hero || "").toUpperCase() };
      });
    }
    if (trackId === "video") {
      var n = 5;
      return Array.from({ length: n }, function(_, i) {
        return { pct: (i / n) * 100, wPct: 100 / n - 1, label: "Clip " + (i + 1) };
      });
    }
    if (trackId === "texto") { return [{ pct: 1, wPct: 97 }]; }
    if (trackId === "audio") { return [{ pct: 0, wPct: 99 }]; }
    return [];
  }

  /* ── CONTENIDO EXPANDIDO ── */
  function renderExpanded(trackId, s) {
    var scenes = s.editorScenes || [];

    if (trackId === "graficos") {
      if (scenes.length === 0) {
        return h("div", { class: "ed-exp-empty" }, "Sin escenas graficas — genera un video primero");
      }
      return h("div", { class: "ed-exp-scenes" },
        scenes.map(function(sc, si) {
          var sel = s.editorSelScene === si;
          return h("div", { class: "ed-scene-row" + (sel ? " ed-scene-row--sel" : ""), onClick: function() { C.setState({ editorSelScene: si }); } },
            h("span", { class: "ed-scene-ts" }, fmtMs(sc.timestamp_ms)),
            h("div", { class: "ed-scene-texts" },
              h("div", { class: "ed-scene-field" },
                h("span", { class: "ed-field-label" }, "HERO"),
                h("input", {
                  class: "ed-inp ed-inp--hero", value: sc.hero || "", maxLength: 8,
                  onInput: function(e) {
                    var updated = scenes.slice();
                    updated[si] = Object.assign({}, sc, { hero: e.target.value.toLowerCase().slice(0, 8) });
                    C.setState({ editorScenes: updated });
                  }
                })
              ),
              h("div", { class: "ed-scene-field" },
                h("span", { class: "ed-field-label" }, "APOYO"),
                h("input", {
                  class: "ed-inp", value: sc.support || "",
                  onInput: function(e) {
                    var updated = scenes.slice();
                    updated[si] = Object.assign({}, sc, { support: e.target.value });
                    C.setState({ editorScenes: updated });
                  }
                })
              )
            ),
            h("button", {
              class: "ed-jump-btn", title: "Ir a este momento en el video",
              onClick: function(e) {
                e.stopPropagation();
                var vid = document.querySelector(".ed-video");
                if (vid) { vid.currentTime = (sc.timestamp_ms || 0) / 1000; vid.play(); }
              }
            }, "\u25B6")
          );
        })
      );
    }

    if (trackId === "video") {
      return h("div", { class: "ed-exp-note-box" },
        h("p", { class: "ed-exp-note" }, "Los cortes de clips se generan automaticamente."),
        h("p", { class: "ed-exp-note" }, "Para recortar: elimina palabras en la transcripcion (panel derecho). Se excluiran del video exportado.")
      );
    }
    if (trackId === "texto") {
      return h("div", { class: "ed-exp-note-box" },
        h("p", { class: "ed-exp-note" }, "Subtitulos generados automaticamente desde la transcripcion."),
        h("p", { class: "ed-exp-note" }, "Edita el texto en el panel de transcripcion a la derecha.")
      );
    }
    if (trackId === "audio") {
      var vol = C.state.musicVol;
      return h("div", { class: "ed-exp-audio" },
        h("div", { class: "ed-audio-row" },
          h("span", { class: "ed-audio-label" }, "\u{1F3B5} Musica de fondo"),
          h("input", { type: "range", min: 0, max: 100, value: vol, class: "ed-vol-slider",
            onInput: function(e) { C.setState({ musicVol: Number(e.target.value) }); }
          }),
          h("span", { class: "ed-vol-val" }, vol + "%")
        ),
        h("div", { class: "ed-audio-row" },
          h("span", { class: "ed-audio-label" }, "\u{1F399}\uFE0F Voz original"),
          h("input", { type: "range", min: 0, max: 100, value: 100, class: "ed-vol-slider" }),
          h("span", { class: "ed-vol-val" }, "100%")
        )
      );
    }
    return null;
  }

  /* ── LINEA DE TIEMPO ── */
  function Timeline() {
    var s = C.state;
    var scenes = s.editorScenes || [];
    var totalSec = scenes.length > 0
      ? Math.max(60, Math.round(scenes[scenes.length - 1].timestamp_ms / 1000) + 15)
      : 60;

    return h("div", { class: "ed-timeline" },
      h("div", { class: "ed-tl-controls" },
        h("button", { class: "ed-tl-play", onClick: function() {
          var vid = document.querySelector(".ed-video");
          if (vid) { vid.paused ? vid.play() : vid.pause(); }
        }}, h("span", { class: "play-tri" })),
        h("span", { class: "ed-tl-label" }, "LINEA DE TIEMPO \u2014 doble clic en pista para editar")
      ),
      h("div", { class: "ed-tl-tracks" },
        D.trackDefs.map(function(track) {
          var expanded = s.editorExpandedTrack === track.id;
          var segs = getTrackSegs(track.id, s, totalSec);
          return h("div", { class: "ed-track" + (expanded ? " ed-track--expanded" : "") },
            h("div", {
              class: "ed-track__header",
              onDblClick: function() { C.setState({ editorExpandedTrack: expanded ? null : track.id }); },
              title: "Doble clic para ver/editar elementos"
            },
              h("span", { class: "ed-track__dot", style: "background:" + track.color }),
              h("span", { class: "ed-track__name" }, track.name),
              h("span", { class: "ed-track__hint" }, expanded ? "\u25B2" : "\u25BC")
            ),
            h("div", { class: "ed-lane" },
              segs.map(function(seg, si) {
                var isSel = s.editorSelScene === si && track.id === "graficos";
                return h("div", {
                  class: "ed-seg" + (isSel ? " ed-seg--sel" : ""),
                  style: "left:" + seg.pct + "%;width:" + Math.max(0.5, seg.wPct - 0.3) + "%;background:" + track.color + (isSel ? "" : "99"),
                  title: seg.label || "",
                  onClick: function(e) {
                    e.stopPropagation();
                    if (track.id === "graficos") C.setState({ editorExpandedTrack: "graficos", editorSelScene: si });
                    else C.setState({ editorExpandedTrack: track.id });
                  }
                });
              })
            ),
            expanded ? h("div", { class: "ed-expanded" }, renderExpanded(track.id, s)) : null
          );
        })
      )
    );
  }

  /* ── ESTADO EXPORTACION ── */
  function ExportStatus() {
    var s = C.state;
    if (!s.editorExporting && !s.editorExportDone) return null;
    if (s.editorExportDone) {
      return h("span", { class: "ed-export-done" },
        "\u2713 Listo \u00B7 ",
        h("a", { href: s.downloadUrl, target: "_blank", class: "ed-export-link" }, "Descargar")
      );
    }
    return h("span", { class: "ed-export-prog" }, "Exportando " + (s.editorExportProgress || 2) + "%...");
  }

  /* ── EDITOR PRINCIPAL ── */
  C.ResultEditor = function () {
    var s = C.state;
    if (!s.resultEdit) return null;

    return h("div", { class: "ed-root" },
      h("div", { class: "ed-topbar" },
        h("div", { class: "ed-topbar__l" },
          h("button", { class: "back-btn", onClick: function() { C.setState({ resultEdit: false }); } }, "\u2190 Volver"),
          h("div", { class: "ed-title" }, "Editar resultado"),
          h("div", { class: "result-badge" }, "EDICI\u00D3N MANUAL")
        ),
        h("div", { class: "ed-topbar__r" },
          ExportStatus(),
          h("button", {
            class: "result-export" + (s.editorExporting ? " result-export--busy" : ""),
            disabled: s.editorExporting,
            onClick: function() { C.actions.exportWithEdits(); }
          }, s.editorExporting ? "Exportando\u2026" : "Exportar \u2192")
        )
      ),
      h("div", { class: "ed-body" },
        h("div", { class: "ed-main" }, VideoPlayer()),
        TranscriptPanel()
      ),
      Timeline()
    );
  };
})();
