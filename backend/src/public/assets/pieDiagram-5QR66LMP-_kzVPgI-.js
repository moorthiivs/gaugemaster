import{p as nt}from"./chunk-JWPE2WC7-D97hBZAZ.js";import{a5 as T,Y as G,bd as it,O as ot,o as st,p as lt,s as ct,g as ut,c as gt,b as dt,_ as d,l as B,x as pt,h as ht,P as ft,T as mt,ae as vt,k as xt}from"./mermaid.core-CWbXc8k_.js";import{p as St}from"./cynefin-OW5HDTMX-LwZ_Y-v8.js";import{d as q}from"./arc-BxznDpNd.js";import{o as yt}from"./ordinal-Cboi1Yqb.js";import"./index-Bixqyhle.js";import"./vendor-charts-BG7xfJ8Q.js";import"./vendor-excel-vWCQdVoP.js";import"./dayjs.min-BTI87toi.js";import"./init-Gi6I4Gst.js";function wt(t,n){return n<t?-1:n>t?1:n>=t?0:NaN}function At(t){return t}function Ct(){var t=At,n=wt,y=null,b=T(0),l=T(G),p=T(0);function i(e){var r,s=(e=it(e)).length,h,w,$=0,f=new Array(s),o=new Array(s),D=+b.apply(this,arguments),E=Math.min(G,Math.max(-G,l.apply(this,arguments)-D)),k,L=Math.min(Math.abs(E)/s,p.apply(this,arguments)),u=L*(E<0?-1:1),A;for(r=0;r<s;++r)(A=o[f[r]=r]=+t(e[r],r,e))>0&&($+=A);for(n!=null?f.sort(function(M,m){return n(o[M],o[m])}):y!=null&&f.sort(function(M,m){return y(e[M],e[m])}),r=0,w=$?(E-s*u)/$:0;r<s;++r,D=k)h=f[r],A=o[h],k=D+(A>0?A*w:0)+u,o[h]={data:e[h],index:r,value:A,startAngle:D,endAngle:k,padAngle:L};return o}return i.value=function(e){return arguments.length?(t=typeof e=="function"?e:T(+e),i):t},i.sortValues=function(e){return arguments.length?(n=e,y=null,i):n},i.sort=function(e){return arguments.length?(y=e,n=null,i):y},i.startAngle=function(e){return arguments.length?(b=typeof e=="function"?e:T(+e),i):b},i.endAngle=function(e){return arguments.length?(l=typeof e=="function"?e:T(+e),i):l},i.padAngle=function(e){return arguments.length?(p=typeof e=="function"?e:T(+e),i):p},i}var J=ot.pie,I={sections:new Map,showData:!1,config:J},W=I.sections,V=I.showData,$t=structuredClone(J),Dt=d(()=>structuredClone($t),"getConfig"),Tt=d(()=>{W=new Map,V=I.showData,pt()},"clear"),bt=d(({label:t,value:n})=>{if(n<0)throw new Error(`"${t}" has invalid value: ${n}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);W.has(t)||(W.set(t,n),B.debug(`added new section: ${t}, with value: ${n}`))},"addSection"),kt=d(()=>W,"getSections"),zt=d(t=>{V=t},"setShowData"),Et=d(()=>V,"getShowData"),K={getConfig:Dt,clear:Tt,setDiagramTitle:st,getDiagramTitle:lt,setAccTitle:ct,getAccTitle:ut,setAccDescription:gt,getAccDescription:dt,addSection:bt,getSections:kt,setShowData:zt,getShowData:Et},Mt=d((t,n)=>{nt(t,n),n.setShowData(t.showData),t.sections.map(n.addSection)},"populateDb"),Rt={parse:d(async t=>{const n=await St("pie",t);B.debug(n),Mt(n,K)},"parse")},Lt=d(t=>`
  .pieCircle{
    stroke: ${t.pieStrokeColor};
    stroke-width : ${t.pieStrokeWidth};
    opacity : ${t.pieOpacity};
  }
  .pieCircle.highlighted{
    scale: 1.05;
    opacity: 1;
  }
  .pieCircle.highlightedOnHover:hover{
    transition-duration: 250ms;
    scale: 1.05;
    opacity: 1;
  }
  .pieOuterCircle{
    stroke: ${t.pieOuterStrokeColor};
    stroke-width: ${t.pieOuterStrokeWidth};
    fill: none;
  }
  .pieTitleText {
    text-anchor: middle;
    font-size: ${t.pieTitleTextSize};
    fill: ${t.pieTitleTextColor};
    font-family: ${t.fontFamily};
  }
  .slice {
    font-family: ${t.fontFamily};
    fill: ${t.pieSectionTextColor};
    font-size:${t.pieSectionTextSize};
    // fill: white;
  }
  .legend text {
    fill: ${t.pieLegendTextColor};
    font-family: ${t.fontFamily};
    font-size: ${t.pieLegendTextSize};
  }
`,"getStyles"),Ot=Lt,Pt=d(t=>{const n=[...t.values()].reduce((l,p)=>l+p,0),y=[...t.entries()].map(([l,p])=>({label:l,value:p})).filter(l=>l.value/n*100>=1);return Ct().value(l=>l.value).sort(null)(y)},"createPieArcs"),Wt=d((t,n,y,b)=>{var Z;B.debug(`rendering pie chart
`+t);const l=b.db,p=ht(),i=ft(l.getConfig(),p.pie),e=40,r=18,s=4,h=450,w=h,$=mt(n),f=$.append("g");f.attr("transform","translate("+w/2+","+h/2+")");const{themeVariables:o}=p;let[D]=vt(o.pieOuterStrokeWidth);D??(D=2);const E=i.legendPosition,k=i.textPosition,L=i.donutHole>0&&i.donutHole<=.9?i.donutHole:0,u=Math.min(w,h)/2-e,A=q().innerRadius(L*u).outerRadius(u),M=q().innerRadius(u*k).outerRadius(u*k),m=f.append("g");m.append("circle").attr("cx",0).attr("cy",0).attr("r",u+D/2).attr("class","pieOuterCircle");const O=l.getSections(),Q=Pt(O),tt=[o.pie1,o.pie2,o.pie3,o.pie4,o.pie5,o.pie6,o.pie7,o.pie8,o.pie9,o.pie10,o.pie11,o.pie12];let _=0;O.forEach(a=>{_+=a});const U=Q.filter(a=>(a.data.value/_*100).toFixed(0)!=="0"),F=yt(tt).domain([...O.keys()]);m.selectAll("mySlices").data(U).enter().append("path").attr("d",A).attr("fill",a=>F(a.data.label)).attr("class",a=>{let c="pieCircle";return i.highlightSlice==="hover"?c+=" highlightedOnHover":i.highlightSlice===a.data.label&&(c+=" highlighted"),c}),m.selectAll("mySlices").data(U).enter().append("text").text(a=>(a.data.value/_*100).toFixed(0)+"%").attr("transform",a=>"translate("+M.centroid(a)+")").style("text-anchor","middle").attr("class","slice");const et=f.append("text").text(l.getDiagramTitle()).attr("x",0).attr("y",-(h-50)/2).attr("class","pieTitleText"),R=[...O.entries()].map(([a,c])=>({label:a,value:c})),C=f.selectAll(".legend").data(R).enter().append("g").attr("class","legend");C.append("rect").attr("width",r).attr("height",r).style("fill",a=>F(a.label)).style("stroke",a=>F(a.label)),C.append("text").attr("x",r+s).attr("y",r-s).text(a=>l.getShowData()?`${a.label} [${a.value}]`:a.label);const z=Math.max(...C.selectAll("text").nodes().map(a=>(a==null?void 0:a.getBoundingClientRect().width)??0));let P=h,H=w+e;const g=r+s,N=R.length*g;switch(E){case"center":C.attr("transform",(a,c)=>{const v=g*R.length/2,x=-z/2-(r+s),S=c*g-v;return"translate("+x+","+S+")"});break;case"top":P+=N,C.attr("transform",(a,c)=>{const v=u,x=-z/2-(r+s),S=c*g-v;return`translate(${x}, ${S})`}),m.attr("transform",()=>`translate(0, ${N+g})`);break;case"bottom":P+=N,C.attr("transform",(a,c)=>{const v=-u-g,x=-z/2-(r+s),S=c*g-v;return"translate("+x+","+S+")"});break;case"left":H+=r+s+z,C.attr("transform",(a,c)=>{const v=g*R.length/2,x=-u-(r+s),S=c*g-v;return"translate("+x+","+S+")"}),m.attr("transform",()=>`translate(${z+r+s}, 0)`);break;case"right":default:H+=r+s+z,C.attr("transform",(a,c)=>{const v=g*R.length/2,x=12*r,S=c*g-v;return"translate("+x+","+S+")"});break}const j=((Z=et.node())==null?void 0:Z.getBoundingClientRect().width)??0,at=w/2-j/2,rt=w/2+j/2,X=Math.min(0,at),Y=Math.max(H,rt)-X;$.attr("viewBox",`${X} 0 ${Y} ${P}`),xt($,P,Y,i.useMaxWidth)},"draw"),_t={draw:Wt},Zt={parser:Rt,db:K,renderer:_t,styles:Ot};export{Zt as diagram};
