// Only already public timeline entries are accepted; no queue or hand data.
export function logLayout(entries,activations,filter=()=>true){
 const roots=new Map(entries.filter(e=>e.root&&e.activation!=null).map(e=>[e.activation,e.index]));
 const acts=new Map(activations.map(a=>[a.seq,a]));
 const rows=entries.filter(filter).reverse().map(e=>({...e,parent:e.root?(roots.get(acts.get(e.activation)?.cause)??null):(roots.get(e.activation??e.cause)??null)}));
 const pos=new Map(rows.map((e,i)=>[e.index,i])),edges=[],ends=[];
 for(const [i,e] of rows.entries()){
  const j=pos.get(e.parent);if(j===undefined||j===i)continue;
  const lo=Math.min(i,j),hi=Math.max(i,j);edges.push({child:e.index,parent:e.parent,lo,hi});
 }
 const trunks=new Map();for(const edge of edges){const trunk=trunks.get(edge.parent)??{lo:edge.lo,hi:edge.hi,edges:[]};trunk.lo=Math.min(trunk.lo,edge.lo);trunk.hi=Math.max(trunk.hi,edge.hi);trunk.edges.push(edge);trunks.set(edge.parent,trunk)}
 for(const trunk of [...trunks.values()].sort((a,b)=>a.lo-b.lo||b.hi-a.hi)){let lane=ends.findIndex(end=>end<trunk.lo);if(lane<0)lane=ends.length;ends[lane]=trunk.hi;for(const edge of trunk.edges)edge.lane=lane}
 return {rows,edges,lanes:ends.length};
}
