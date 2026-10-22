export type BulkSlab={minQty:number;maxQty:number|null;pricePerUnit:number};
export function unitPriceForQuantity(base:number,quantity:number,slabs:BulkSlab[]=[]):number{
  if(!Number.isSafeInteger(quantity)||quantity<1)throw new Error("Invalid quantity");
  const slab=slabs.find(s=>Number.isSafeInteger(s.minQty)&&s.minQty>=1&&s.minQty<=quantity&&(s.maxQty===null||s.maxQty>=quantity)&&Number.isFinite(s.pricePerUnit)&&s.pricePerUnit>0);
  return slab?slab.pricePerUnit:base;
}
