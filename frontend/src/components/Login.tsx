import React, { useState } from "react";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "../firebase";
import { Loader2, BookOpen } from "lucide-react";

export const Login: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      // Remover setLoading(true) porque interfiere con el entorno "Trusted User Event" requerido por el navegador
      // para delegarle a Firebase permisos plenos sobre window.opener.
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="flex h-dvh w-full items-center justify-center bg-background px-4 font-sans text-foreground">
      <div className="w-full max-w-sm rounded-[1.25rem] border border-border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <BookOpen className="size-10 text-primary mb-4" />
          <h1 className="font-serif text-3xl font-bold tracking-tight mb-2">
            TutorIA
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            Inicia sesión para continuar con tu cuaderno de aprendizaje.
          </p>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-[15px] font-medium transition-colors hover:bg-muted hover:border-primary/30 focus:outline-none active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            ) : (
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google Logo"
                className="size-5"
              />
            )}
            Ingresar con Google
          </button>

          {error && (
            <p className="mt-6 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive border border-destructive/20 w-full">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
