import { login, signup } from './actions'
import { Mail, Shield } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="px-8 pt-8 pb-6">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
                <Mail className="w-8 h-8 text-white" />
              </div>
            </div>
            
            <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">
              Email Tracking
            </h1>
            <p className="text-center text-gray-600 mb-8">
              Suivez vos emails professionnels et gérez vos relances automatiquement
            </p>

            <form className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="votre@email.com"
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Mot de passe
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="••••••••"
                />
              </div>

              <div className="flex space-x-3">
                <button
                  formAction={login}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Se connecter
                </button>
                <button
                  formAction={signup}
                  className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors"
                >
                  S'inscrire
                </button>
              </div>
            </form>

            <div className="mt-8 space-y-3">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">Connexion sécurisée</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Authentification sécurisée avec Supabase
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">Données protégées</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Vos données sont chiffrées et sécurisées
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-8 py-4 bg-gray-50 border-t border-gray-100">
            <p className="text-xs text-center text-gray-500">
              En vous connectant, vous acceptez nos conditions d&apos;utilisation et notre politique de confidentialité
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}