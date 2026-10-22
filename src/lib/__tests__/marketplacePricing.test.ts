import {expect,it} from "vitest";
import {unitPriceForQuantity} from "../marketplacePricing";
it("applies the matching bulk slab at inclusive boundaries",()=>{const slabs=[{minQty:1,maxQty:9,pricePerUnit:100},{minQty:10,maxQty:null,pricePerUnit:80}];expect(unitPriceForQuantity(100,9,slabs)).toBe(100);expect(unitPriceForQuantity(100,10,slabs)).toBe(80);});
it("rejects invalid quantities and falls back when no slab matches",()=>{expect(()=>unitPriceForQuantity(100,0)).toThrow();expect(unitPriceForQuantity(100,3,[])).toBe(100);});
