// Formulario de producto: nombre, categoría, precio y stock
import { Link } from 'react-router-dom';
import { ChevronDown, Flame, GlassWater, Package, Infinity as InfinityIcon } from 'lucide-react';
import { Input, Label } from '../../../components/ui';
import { cn } from '../../../utils/cn';

export function DatosProducto({ editProd, esBarra, infoCategoria, setEditProd, todasLasCategorias }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_12rem] gap-4">
        <div>
          <Label htmlFor="prod-nombre">Nombre</Label>
          <Input
            id="prod-nombre"
            autoFocus={!editProd.id}
            value={editProd.nombre}
            onChange={e => setEditProd({ ...editProd, nombre: e.target.value })}
            placeholder="Ej: 1/4 Pollo a la Brasa"
            className="h-12 text-base focus:border-amber-500 focus:ring-amber-100"
          />
        </div>
        <div>
          <Label htmlFor="prod-precio">Precio</Label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-emerald-600 select-none">S/</span>
            <Input
              id="prod-precio"
              type="number"
              step="any"
              min="0"
              inputMode="decimal"
              value={editProd.precio}
              onChange={e => setEditProd({ ...editProd, precio: e.target.value })}
              placeholder="0.00"
              className="h-12 pl-11 text-lg font-black font-mono text-emerald-700 focus:border-emerald-500 focus:ring-emerald-100"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="prod-categoria">Categoría</Label>
            <Link to="/categorias" className="mb-1.5 text-xs font-bold text-violet-600 hover:underline">Administrar</Link>
          </div>
          <div className="relative">
            {(() => {
              const info = infoCategoria(editProd.categoria);
              const IconoDestino = info.barra ? GlassWater : Flame;
              return (
                <span className={cn('pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center', info.barra ? 'bg-sky-100 text-sky-600' : 'bg-amber-100 text-amber-600')}>
                  <IconoDestino className="w-4 h-4" />
                </span>
              );
            })()}
            <select
              id="prod-categoria"
              value={editProd.categoria}
              onChange={e => setEditProd({ ...editProd, categoria: e.target.value })}
              className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-12 pr-10 text-sm font-bold text-slate-900 focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100 cursor-pointer"
            >
              {!editProd.categoria && <option value="">Elegir categoría...</option>}
              {todasLasCategorias.map(cat => (
                <option key={cat} value={cat}>{cat}{esBarra(cat) ? '  · Barra' : ''}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          </div>
          <p className="mt-1.5 text-xs font-semibold text-slate-400">
            Se prepara en {esBarra(editProd.categoria) ? <span className="text-sky-600">Barra</span> : <span className="text-amber-600">Cocina</span>}
          </p>
        </div>

        <div>
          <Label htmlFor="prod-stock">Disponibles</Label>
          <div className="relative">
            <Package className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              id="prod-stock"
              type="number"
              min="0"
              inputMode="numeric"
              value={editProd.stock}
              onChange={e => setEditProd({ ...editProd, stock: e.target.value })}
              placeholder="Sin límite"
              className="h-12 pl-12 pr-12 text-base font-black font-mono focus:border-sky-500 focus:ring-sky-100 placeholder:font-sans placeholder:font-semibold"
            />
            {String(editProd.stock ?? '') !== '' && (
              <button
                type="button"
                onClick={() => setEditProd({ ...editProd, stock: '' })}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                title="Sin límite"
              >
                <InfinityIcon className="w-5 h-5" />
              </button>
            )}
          </div>
          <p className="mt-1.5 text-xs font-semibold text-slate-400">
            {String(editProd.stock ?? '') === '' ? 'Vacío = siempre hay' : 'Al llegar a 0 sale AGOTADO'}
          </p>
        </div>
      </div>

      <div>
        <Label htmlFor="prod-ingredientes" className="text-xs text-slate-500">
          Ingredientes <span className="font-medium text-slate-400">(opcional)</span>
        </Label>
        <Input
          id="prod-ingredientes"
          value={editProd.ingredientes || ''}
          onChange={e => setEditProd({ ...editProd, ingredientes: e.target.value })}
          placeholder="Ej: papas fritas, ensalada, cremas"
          className="h-10 text-sm font-medium"
        />
      </div>
    </div>
  );
}
