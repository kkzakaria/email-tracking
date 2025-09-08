import { login, signup } from './actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Mail, Shield, Zap, BarChart3, Lock, User } from "lucide-react"

interface LoginPageProps {
  searchParams: {
    message?: string
  }
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const message = searchParams.message

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="w-full max-w-md px-4">
        <Card className="shadow-2xl border-0">
          <CardHeader className="text-center space-y-6 pb-8">
            {/* Logo */}
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Mail className="w-10 h-10 text-white" />
              </div>
            </div>
            
            {/* Title */}
            <div className="space-y-2">
              <CardTitle className="text-3xl font-bold text-slate-900">
                Email Tracking
              </CardTitle>
              <CardDescription className="text-base text-slate-600 leading-relaxed">
                Suivez vos emails professionnels et gérez vos réponses en temps réel
              </CardDescription>
            </div>

            {/* Message d'erreur ou d'info */}
            {message && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">{decodeURIComponent(message)}</p>
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-8">
            {/* Formulaire de connexion */}
            <form className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="w-full h-11 bg-white border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                    placeholder="votre@email.com"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Mot de passe
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="w-full h-11 bg-white border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex space-x-3">
                <Button
                  formAction={login}
                  className="flex-1 h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  Se connecter
                </Button>
                <Button
                  formAction={signup}
                  variant="outline"
                  className="flex-1 h-11 border-slate-200 hover:bg-slate-50 font-medium"
                >
                  S&apos;inscrire
                </Button>
              </div>
            </form>

            {/* Features */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col items-center p-4 bg-slate-50 rounded-xl">
                  <BarChart3 className="w-6 h-6 text-blue-600 mb-2" />
                  <span className="text-xs font-medium text-slate-700 text-center">Tracking temps réel</span>
                </div>
                
                <div className="flex flex-col items-center p-4 bg-slate-50 rounded-xl">
                  <Zap className="w-6 h-6 text-indigo-600 mb-2" />
                  <span className="text-xs font-medium text-slate-700 text-center">Détection automatique</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-100">
                <Shield className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-green-800">
                    Sécurisé & Privé
                  </p>
                  <p className="text-xs text-green-700 leading-relaxed">
                    Authentification sécurisée avec chiffrement des données.
                  </p>
                </div>
              </div>
            </div>

            {/* Technology Badges */}
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                Supabase Auth
              </Badge>
              <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 hover:bg-indigo-200">
                Sécurisé
              </Badge>
              <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-200">
                Temps réel
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
            En vous connectant, vous acceptez nos conditions d&apos;utilisation. 
            L&apos;authentification Microsoft sera demandée dans l&apos;application.
          </p>
        </div>
      </div>
    </div>
  )
}