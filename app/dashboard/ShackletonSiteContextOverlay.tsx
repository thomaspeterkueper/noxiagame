'use client'

export default function ShackletonSiteContextOverlay() {
  return <aside className="shackleton-site-context" aria-label="Shackleton Standortkontext">
    <div className="head">
      <small>STANDORTKONTEXT · PLANUNGSSTUFE</small>
      <strong>Shackleton Rim / Ridge Base</strong>
      <span>Schematisch · noch nicht metrisch an den verifizierten LOLA-Origin gebunden</span>
    </div>
    <div className="diagram" aria-hidden="true">
      <div className="sun-band">LICHTKANTE</div>
      <div className="ridge">
        <i className="solar"/><i className="comms"/>
        <b className="base">BASE ALPHA</b>
        <i className="landing"/>
      </div>
      <div className="descent"><span>Abstiegskorridor</span></div>
      <div className="psr"><b>PSR</b><span>Forschung / spätere ISRU</span></div>
    </div>
    <div className="legend">
      <span><i className="dot base-dot"/> Ridge Base</span>
      <span><i className="dot light-dot"/> Energie / Comms</span>
      <span><i className="dot landing-dot"/> Landezone</span>
      <span><i className="dot psr-dot"/> PSR</span>
    </div>
    <style jsx>{`
      .shackleton-site-context{position:fixed;z-index:3;right:18px;bottom:calc(var(--noxia-cockpit-clearance,76px) + 16px);width:310px;padding:10px;border:1px solid rgba(190,198,190,.28);border-radius:10px;background:rgba(6,10,12,.78);backdrop-filter:blur(8px);box-shadow:0 10px 28px rgba(0,0,0,.28);color:#dce4e1;pointer-events:none}
      .head{display:grid;gap:2px}.head small{font:800 8px/1.2 ui-monospace,monospace;letter-spacing:.12em;color:#bda96e}.head strong{font:600 13px/1.2 Georgia,serif}.head span{font:9px/1.25 system-ui,sans-serif;color:#89989e}
      .diagram{position:relative;height:105px;margin-top:8px;border:1px solid rgba(135,149,151,.18);border-radius:7px;overflow:hidden;background:linear-gradient(180deg,#3b3d39 0 37%,#242724 37% 58%,#111414 58% 100%)}
      .sun-band{position:absolute;left:0;top:0;right:0;height:17px;padding-left:8px;display:flex;align-items:center;background:linear-gradient(90deg,rgba(216,188,89,.52),rgba(216,188,89,.05));color:#f0d77c;font:800 7px/1 ui-monospace,monospace;letter-spacing:.11em}
      .ridge{position:absolute;left:-3%;top:30px;width:78%;height:35px;transform:skewX(-18deg);background:linear-gradient(180deg,#8a8d85,#5d615b);border-top:2px solid #d7d2be;box-shadow:0 5px 14px rgba(0,0,0,.28)}
      .ridge i,.ridge b{position:absolute;transform:skewX(18deg)}.solar{left:15%;top:-9px;width:5px;height:19px;background:#d6b44e;box-shadow:9px 0 0 #d6b44e,18px 0 0 #d6b44e}.comms{left:34%;top:-13px;width:2px;height:23px;background:#72c9c3}.comms:after{content:'';position:absolute;left:-5px;top:1px;width:12px;height:6px;border:1px solid #72c9c3;border-radius:50%}.base{left:42%;top:10px;padding:2px 5px;border-radius:4px;background:#dfe5df;color:#263238;font:800 7px/1 ui-monospace,monospace;white-space:nowrap}.landing{left:76%;top:10px;width:24px;height:10px;border:2px solid #c6b98a;border-radius:50%}
      .descent{position:absolute;left:62%;top:55px;width:42%;height:34px;transform:rotate(22deg);transform-origin:left top;border-top:2px dashed rgba(192,177,122,.72)}.descent span{position:absolute;left:10px;top:4px;transform:rotate(-22deg);font:7px/1 ui-monospace,monospace;color:#b6aa83;white-space:nowrap}
      .psr{position:absolute;right:7px;bottom:7px;display:grid;text-align:right}.psr b{font:900 10px/1 ui-monospace,monospace;color:#8096a3}.psr span{font:7px/1.1 system-ui,sans-serif;color:#60717a}
      .legend{display:flex;gap:7px;flex-wrap:wrap;margin-top:7px;color:#93a1a5;font:8px/1.2 system-ui,sans-serif}.legend span{display:flex;align-items:center;gap:4px}.dot{width:6px;height:6px;border-radius:50%}.base-dot{background:#dfe5df}.light-dot{background:#d6b44e}.landing-dot{background:#c6b98a}.psr-dot{background:#60717a}
      @media(max-width:900px){.shackleton-site-context{width:250px;right:10px;bottom:calc(var(--noxia-cockpit-clearance,76px) + 10px)}.diagram{height:90px}}
      @media(max-width:620px){.shackleton-site-context{display:none}}
    `}</style>
  </aside>
}
