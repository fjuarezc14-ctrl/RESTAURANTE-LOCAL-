import { useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Flame, GlassWater, Tags, Check, Search, X, ArrowRight } from 'lucide-react';
import { api } from '../api';
import { useCompany } from '../context/CompanyContext';
import { Button, Input, Label, Card, Badge, Dialog, DialogHeader, DialogFooter } from '../components/ui';
import { cn } from '../utils/cn';
import { COLORES_CATEGORIA, colorCategoria, ordenarCategorias } from '../utils/categorias';
import { useCargar } from '../hooks/useCargar';

const DESTINOS = {
  cocina: { label: 'Cocina', Icon: Flame, activo: 'border-amber-500 bg-amber-50 text-amber-900', icono: 'bg-amber-500 text-white', header: 'text-amber-700', chip: 'bg-amber-100 text-amber-800' },
  barra: { label: 'Barra', Icon: GlassWater, activo: 'border-sky-500 bg-sky-50 text-sky-900', icono: 'bg-sky-500 text-white', header: 'text-sky-700', chip: 'bg-sky-100 text-sky-800' },
};

const FORM_VACIO = { id: null, nombre: '', destino: 'cocina', color: 'amber' };

export default function CategoriasPage() {
  const { reloadEmpresa } = useCompany();
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  const [form, setForm] = useState(FORM_VACIO);
  const [formAbierto, setFormAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState('');

  const [aEliminar, setAEliminar] = useState(null);
  const [moverA, setMoverA] = useState('');
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState('');

  const cargar = useCallback(async () => {
    try {
      const data = await api.getCategorias();
      setCategorias(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando categorías:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useCargar(cargar);

  const abrirForm = (cat = null) => {
    setForm(cat ? { id: cat.id, nombre: cat.nombre, destino: cat.destino, color: cat.color } : FORM_VACIO);
    setErrorForm('');
    setFormAbierto(true);
  };

  const guardar = async () => {
    const nombre = form.nombre.trim();
    if (!nombre) { setErrorForm('Escribe un nombre.'); return; }
    setGuardando(true);
    setErrorForm('');
    try {
      const body = { nombre, destino: form.destino, color: form.color };
      if (form.id) await api.editarCategoria(form.id, body);
      else await api.crearCategoria(body);
      setFormAbierto(false);
      await Promise.all([cargar(), reloadEmpresa()]);
    } catch (err) {
      setErrorForm(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const pedirEliminar = (cat) => {
    setAEliminar(cat);
    setMoverA('');
    setErrorEliminar('');
  };

  const confirmarEliminar = async () => {
    if (!aEliminar) return;
    if (aEliminar.productos > 0 && !moverA) { setErrorEliminar('Elige a dónde mover los productos.'); return; }
    setEliminando(true);
    try {
      await api.eliminarCategoria(aEliminar.id, aEliminar.productos > 0 ? moverA : null);
      setAEliminar(null);
      await Promise.all([cargar(), reloadEmpresa()]);
    } catch (err) {
      setErrorEliminar(err.message);
    } finally {
      setEliminando(false);
    }
  };

  const filtradas = ordenarCategorias(
    categorias.filter(c => c.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())),
    c => c.nombre
  );

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <section className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
      {/* Cabecera */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-violet-500 text-white flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Tags className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900">Categorías</h1>
            <p className="text-sm text-slate-500">{categorias.length} en total</p>
          </div>
        </div>
        <Button variant="success" size="lg" onClick={() => abrirForm()} className="self-stretch sm:self-auto">
          <Plus className="w-5 h-5" /> Nueva categoría
        </Button>
      </div>

      {/* Buscador */}
      {categorias.length > 8 && (
        <div className="mb-6 relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <Input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar..." className="pl-12 h-12 rounded-2xl" />
          {busqueda && (
            <button onClick={() => setBusqueda('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* Dos columnas: Cocina y Barra */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {['cocina', 'barra'].map(destino => {
          const d = DESTINOS[destino];
          const lista = filtradas.filter(c => c.destino === destino);
          return (
            <div key={destino}>
              <div className="flex items-center gap-2 mb-3">
                <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', d.icono)}>
                  <d.Icon className="w-4 h-4" />
                </div>
                <h2 className={cn('font-black text-lg', d.header)}>{d.label}</h2>
                <Badge className={d.chip}>{lista.length}</Badge>
              </div>

              {lista.length === 0 ? (
                <Card className="p-8 text-center text-slate-400 border-dashed">Sin categorías</Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {lista.map(cat => {
                    const col = colorCategoria(cat.color);
                    return (
                      <Card key={cat.id} className={cn('p-4 border-l-8 flex items-center gap-3 hover:shadow-md transition-shadow', col.border)}>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-slate-900 truncate" title={cat.nombre}>{cat.nombre}</p>
                          <p className="text-sm text-slate-500">
                            {cat.productos === 0 ? 'Vacía' : `${cat.productos} producto${cat.productos === 1 ? '' : 's'}`}
                          </p>
                        </div>
                        <Button variant="outline" size="icon" onClick={() => abrirForm(cat)} title="Editar" className="text-sky-600 hover:bg-sky-50 hover:border-sky-300">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => pedirEliminar(cat)} title="Eliminar" className="text-red-500 hover:bg-red-50 hover:border-red-300">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Crear / editar */}
      <Dialog open={formAbierto} onClose={() => setFormAbierto(false)} className="sm:max-w-md">
        <DialogHeader
          icon={form.id ? Pencil : Plus}
          iconClassName={form.id ? 'bg-sky-100 text-sky-600' : 'bg-emerald-100 text-emerald-600'}
          title={form.id ? 'Editar categoría' : 'Nueva categoría'}
          onClose={() => setFormAbierto(false)}
        />
        <div className="p-5 space-y-5 overflow-y-auto">
          <div>
            <Label htmlFor="cat-nombre">Nombre</Label>
            <Input
              id="cat-nombre"
              autoFocus
              value={form.nombre}
              onChange={e => setForm({ ...form, nombre: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') guardar(); }}
              placeholder="Ej: Chifa, Pizzas, Jugos"
              className="h-12 text-base"
            />
          </div>

          <div>
            <Label>¿Dónde se prepara?</Label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(DESTINOS).map(([key, d]) => {
                const activo = form.destino === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm({ ...form, destino: key, color: key === 'barra' && form.color === 'amber' ? 'sky' : (key === 'cocina' && form.color === 'sky' ? 'amber' : form.color) })}
                    className={cn(
                      'relative flex flex-col items-center gap-2 rounded-2xl border-2 p-4 font-black transition-all cursor-pointer',
                      activo ? d.activo : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    )}
                  >
                    <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center', activo ? d.icono : 'bg-slate-100 text-slate-400')}>
                      <d.Icon className="w-6 h-6" />
                    </div>
                    {d.label}
                    {activo && <Check className="absolute top-2 right-2 w-5 h-5" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2.5">
              {Object.entries(COLORES_CATEGORIA).map(([key, col]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm({ ...form, color: key })}
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center transition-transform cursor-pointer',
                    col.dot,
                    form.color === key ? 'ring-4 ring-offset-2 ring-slate-300 scale-110' : 'hover:scale-105'
                  )}
                  aria-label={key}
                >
                  {form.color === key && <Check className="w-5 h-5 text-white" />}
                </button>
              ))}
            </div>
          </div>

          {form.id && categorias.find(c => c.id === form.id)?.productos > 0 && (
            <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-3">
              Los productos de esta categoría se actualizan solos.
            </p>
          )}

          {errorForm && <p className="text-sm font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{errorForm}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setFormAbierto(false)}>Cancelar</Button>
          <Button variant="success" onClick={guardar} disabled={guardando} className="min-w-32">
            {guardando ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Check className="w-5 h-5" />}
            Guardar
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Eliminar */}
      <Dialog open={!!aEliminar} onClose={() => setAEliminar(null)} className="sm:max-w-md">
        {aEliminar && (
          <>
            <DialogHeader icon={Trash2} iconClassName="bg-red-100 text-red-600" title="¿Eliminar categoría?" onClose={() => setAEliminar(null)}>
              <p className="text-sm font-bold text-slate-600 truncate">{aEliminar.nombre}</p>
            </DialogHeader>
            <div className="p-5 space-y-4">
              {aEliminar.productos > 0 ? (
                <>
                  <p className="text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    Tiene <strong>{aEliminar.productos} producto{aEliminar.productos === 1 ? '' : 's'}</strong>. ¿A dónde los mueves?
                  </p>
                  <div className="flex items-center gap-2">
                    <ArrowRight className="w-5 h-5 text-slate-400 shrink-0" />
                    <select
                      value={moverA}
                      onChange={e => setMoverA(e.target.value)}
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base font-semibold text-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-100 cursor-pointer"
                    >
                      <option value="">Elegir categoría...</option>
                      {ordenarCategorias(categorias.filter(c => c.id !== aEliminar.id), c => c.nombre).map(c => (
                        <option key={c.id} value={c.nombre}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-600">No tiene productos. Se puede eliminar sin problema.</p>
              )}
              {errorEliminar && <p className="text-sm font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{errorEliminar}</p>}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAEliminar(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={confirmarEliminar} disabled={eliminando || (aEliminar.productos > 0 && !moverA)}>
                {eliminando ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {aEliminar.productos > 0 ? 'Mover y eliminar' : 'Eliminar'}
              </Button>
            </DialogFooter>
          </>
        )}
      </Dialog>
    </section>
  );
}
