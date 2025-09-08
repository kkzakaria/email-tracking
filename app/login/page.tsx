import { login } from './actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mail, Lock, User } from "lucide-react"

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
              <CardDescription className="text-base text-slate-600">
                Connectez-vous à votre compte
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

              <Button
                formAction={login}
                className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200"
              >
                Se connecter
              </Button>
            </form>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}