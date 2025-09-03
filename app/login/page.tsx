"use client";

import { signIn } from "next-auth/react";
import { Mail, Shield, ArrowRight } from "lucide-react";

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

            <div className="space-y-4">
              <button
                onClick={() => signIn("microsoft-entra-id", { callbackUrl: "/dashboard" })}
                className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 21 21"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                  <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                  <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                  <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
                </svg>
                Se connecter avec Microsoft
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-8 space-y-3">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">Connexion sécurisée</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Authentification via Microsoft Azure AD avec OAuth 2.0
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">Permissions limitées</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Accès uniquement aux emails pour le suivi et les rappels
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