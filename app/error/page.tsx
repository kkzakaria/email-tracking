import { AlertTriangle, Home } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"

interface ErrorPageProps {
  searchParams: {
    message?: string
  }
}

export default function ErrorPage({ searchParams }: ErrorPageProps) {
  const errorMessage = searchParams.message || 'Une erreur inconnue s\'est produite'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-red-50 to-orange-100">
      <div className="w-full max-w-md px-4">
        <Card className="shadow-2xl border-0">
          <CardHeader className="text-center space-y-6 pb-6">
            {/* Error Icon */}
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                <AlertTriangle className="w-10 h-10 text-white" />
              </div>
            </div>
            
            {/* Title */}
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold text-slate-900">
                Erreur d&apos;authentification
              </CardTitle>
              <CardDescription className="text-base text-slate-600">
                Une erreur s&apos;est produite lors de la connexion
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Error Alert */}
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800 font-medium">
                {decodeURIComponent(errorMessage)}
              </AlertDescription>
            </Alert>

            {/* Solutions */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Solutions possibles :</h3>
              <ul className="text-sm text-slate-600 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full mt-2 flex-shrink-0"></span>
                  Vérifiez que votre compte Microsoft est actif
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full mt-2 flex-shrink-0"></span>
                  Assurez-vous d&apos;autoriser l&apos;accès aux emails
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full mt-2 flex-shrink-0"></span>
                  Essayez de vous reconnecter dans quelques minutes
                </li>
              </ul>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-2">
              <Button asChild className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                <Link href="/login">
                  <Home className="w-4 h-4 mr-2" />
                  Retour à la connexion
                </Link>
              </Button>
              
              <Button 
                variant="outline" 
                asChild 
                className="w-full h-11 border-slate-200 hover:bg-slate-50"
              >
                <Link href={`mailto:support@yourapp.com?subject=Problème de connexion&body=Erreur: ${encodeURIComponent(errorMessage)}`}>
                  Contacter le support
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            Si le problème persiste, contactez votre administrateur Microsoft 365
          </p>
        </div>
      </div>
    </div>
  )
}