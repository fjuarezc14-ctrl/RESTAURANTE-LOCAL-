import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Actualiza el estado para que la proxima renderizacion muestre la interfaz de repuesto
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error capturado por Error Boundary:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Interfaz de repuesto cuando se cae el sistema/internet
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-800 p-4 text-center">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl max-w-md w-full text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-red-500 to-amber-500"></div>
            <span className="text-5xl mb-4 block animate-bounce">📡</span>
            <h1 className="text-2xl font-black text-white mb-2">¡Ups! Interrupción de Red</h1>
            <p className="text-slate-400 mb-6 text-xs leading-relaxed">
              El sistema no pudo cargar o sincronizar la pantalla debido a una demora de red o corte de internet.
            </p>
            <button 
              onClick={this.handleReset} 
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black py-3.5 px-6 rounded-2xl w-full transition-all shadow-lg shadow-amber-500/20 active:scale-95 text-xs uppercase tracking-wider flex items-center justify-center gap-2"
            >
              🔄 Recargar Sistema
            </button>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
