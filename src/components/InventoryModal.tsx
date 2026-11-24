import React, { useMemo, useState } from 'react';
import { getOrganizedInventoryRows } from '../game/kioscoLogic';
import type {
  InventorySortKey,
  ProductCategory,
  ProductId,
  SoldRecord,
} from '../game/types';

interface InventoryModalProps {
  stock: Record<ProductId, number>;
  sold: Record<ProductId, SoldRecord>;
  onRestock: (productId: ProductId) => void;
  onOrganizeShelves: () => void;
  onClose: () => void;
}

const CATEGORIES: Array<ProductCategory | 'Todas'> = [
  'Todas',
  'Carnes y Lácteos',
  'Almacén',
  'Bebidas',
  'Panadería',
];

export const InventoryModal: React.FC<InventoryModalProps> = ({
  stock,
  sold,
  onRestock,
  onOrganizeShelves,
  onClose,
}) => {
  const [category, setCategory] = useState<ProductCategory | 'Todas'>('Todas');
  const [sortBy, setSortBy] = useState<InventorySortKey>('sold_desc');

  const rows = useMemo(
    () => getOrganizedInventoryRows(stock, sold, category, sortBy),
    [stock, sold, category, sortBy]
  );

  const totals = useMemo(() => {
    let unitsSold = 0;
    let totalRevenue = 0;
    let totalStock = 0;
    for (const r of Object.values(sold)) {
      unitsSold += r.quantitySold;
      totalRevenue += r.revenue;
    }
    for (const s of Object.values(stock)) {
      totalStock += s;
    }
    return { unitsSold, totalRevenue, totalStock };
  }, [stock, sold]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-2.5 md:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Inventario y Productos Vendidos"
    >
      <div className="w-full max-w-3xl max-h-[92%] flex flex-col mc-panel-stone p-4 md:p-6 text-amber-50">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-700 pb-2.5">
          <div>
            <h2 className="text-lg md:text-xl font-display font-bold text-amber-300">
              PRODUCTOS Y VENTAS
            </h2>
            <p className="text-xs text-stone-300">
              Mirá lo que vendiste, traé más cosas si faltan y ordená los estantes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOrganizeShelves}
              className="min-h-[38px] px-3 py-1.5 mc-btn mc-btn-gold text-xs font-bold cursor-pointer"
            >
              Ordenar Estantes
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-w-[38px] min-h-[38px] px-2.5 py-1 mc-btn mc-btn-stone text-sm font-bold cursor-pointer"
              aria-label="Cerrar inventario"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="mc-slot p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-stone-400">Vendidos</div>
            <div className="text-lg md:text-xl font-display font-bold font-mono-num text-emerald-400">
              {totals.unitsSold}
            </div>
          </div>
          <div className="mc-slot p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-stone-400">Plata ganada</div>
            <div className="text-lg md:text-xl font-display font-bold font-mono-num text-amber-300">
              ${totals.totalRevenue.toLocaleString('es-AR')}
            </div>
          </div>
          <div className="mc-slot p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-stone-400">En el Súper</div>
            <div className="text-lg md:text-xl font-display font-bold font-mono-num text-sky-300">
              {totals.totalStock}
            </div>
          </div>
        </div>

        {/* Filter & Sort Controls */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`min-h-[34px] px-3 py-1 mc-btn text-xs font-bold cursor-pointer ${
                  category === cat ? 'mc-btn-gold' : 'mc-btn-dark'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="inv-sort-select" className="text-xs text-stone-400">
              Ordenar:
            </label>
            <select
              id="inv-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as InventorySortKey)}
              className="min-h-[34px] px-2.5 py-1 mc-slot text-xs text-amber-100"
            >
              <option value="sold_desc">Más vendidos</option>
              <option value="revenue_desc">Más plata</option>
              <option value="stock_asc">Faltan reponer</option>
              <option value="name_asc">Nombre (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="mt-2.5 overflow-y-auto touch-pan-y flex-1 mc-slot">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900 text-stone-400 uppercase text-[10px] tracking-wider sticky top-0">
              <tr>
                <th className="py-2 px-2.5">Producto</th>
                <th className="py-2 px-2.5 hidden sm:table-cell">Tipo</th>
                <th className="py-2 px-2.5 text-right">Precio</th>
                <th className="py-2 px-2.5 text-right">Hay</th>
                <th className="py-2 px-2.5 text-right">Vendidos</th>
                <th className="py-2 px-2.5 text-right hidden sm:table-cell">Plata</th>
                <th className="py-2 px-2.5 hidden md:table-cell">Cliente</th>
                <th className="py-2 px-2.5 text-right">Sumar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {rows.map((row) => (
                <tr key={row.product.id} className="hover:bg-zinc-900/60">
                  <td className="py-2 px-2.5 font-semibold text-amber-50">{row.product.name}</td>
                  <td className="py-2 px-2.5 text-stone-400 hidden sm:table-cell">
                    {row.product.category}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono-num">
                    ${row.product.price.toLocaleString('es-AR')}
                  </td>
                  <td
                    className={`py-2 px-2.5 text-right font-mono-num font-bold ${
                      row.stock <= 1 ? 'text-red-400' : 'text-sky-300'
                    }`}
                  >
                    {row.stock}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono-num font-bold text-emerald-400">
                    {row.quantitySold}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono-num text-amber-300 hidden sm:table-cell">
                    ${row.revenue.toLocaleString('es-AR')}
                  </td>
                  <td className="py-2 px-2.5 text-stone-300 hidden md:table-cell">
                    {row.lastSoldCustomer}
                  </td>
                  <td className="py-2 px-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => onRestock(row.product.id)}
                      className="min-h-[34px] px-3 py-1 mc-btn mc-btn-stone text-xs font-bold cursor-pointer"
                    >
                      +2 más
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
