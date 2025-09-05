import { signInWithMicrosoft } from './actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Mail, Shield, Zap, BarChart3 } from "lucide-react"

export default function LoginPage() {
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
          </CardHeader>

          <CardContent className="space-y-8">
            {/* Microsoft Login Button */}
            <form action={signInWithMicrosoft} className="space-y-4">
              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium text-base shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <svg 
                  className="w-5 h-5 mr-3" 
                  viewBox="0 0 21 21" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path fill="#f35325" d="M10 0H0v10h10V0z"/>
                  <path fill="#81bc06" d="M21 0H11v10h10V0z"/>
                  <path fill="#05a6f0" d="M10 11H0v10h10V11z"/>
                  <path fill="#ffba08" d="M21 11H11v10h10V11z"/>
                </svg>
                Se connecter avec Microsoft
              </Button>
              
              <p className="text-xs text-center text-slate-500 leading-relaxed">
                Connexion sécurisée via Microsoft 365 pour accéder à vos emails
              </p>
            </form>

            {/* Features */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col items-center p-4 bg-slate-50 rounded-xl">
                  <BarChart3 className="w-6 h-6 text-blue-600 mb-2" />
                  <span className="text-xs font-medium text-slate-700 text-center">Tracking en temps réel</span>
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
                    Vos données restent dans Microsoft 365. Aucun email n&apos;est stocké sur nos serveurs.
                  </p>
                </div>
              </div>
            </div>

            {/* Technology Badges */}
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                Microsoft Graph
              </Badge>
              <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 hover:bg-indigo-200">
                OAuth 2.0
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
            En vous connectant, vous acceptez l&apos;accès en lecture/écriture à vos emails Microsoft 365 
            pour le suivi des réponses et l&apos;envoi d&apos;emails trackés.
          </p>
        </div>
      </div>
    </div>
  )
}