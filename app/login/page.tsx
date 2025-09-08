"use client"

import { useState, useId, use } from "react"
import { EyeIcon, EyeOffIcon, Mail } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ModeToggle } from "@/components/mode-toggle"
import { login } from './actions'

interface LoginPageProps {
  searchParams: Promise<{
    message?: string
  }>
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = use(searchParams)
  const message = resolvedSearchParams.message
  const emailId = useId()
  const passwordId = useId()
  const [isPasswordVisible, setIsPasswordVisible] = useState<boolean>(false)

  const togglePasswordVisibility = () => setIsPasswordVisible((prev) => !prev)

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>
      
      <div className="w-full max-w-md px-4">
        <Card>
          <CardHeader className="text-center space-y-6">
            {/* Logo */}
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center">
                <Mail className="w-8 h-8 text-primary-foreground" />
              </div>
            </div>
            
            {/* Title */}
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold">
                Email Tracking
              </CardTitle>
              <CardDescription>
                Connectez-vous à votre compte
              </CardDescription>
            </div>

            {/* Message d'erreur ou d'info */}
            {message && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">{decodeURIComponent(message)}</p>
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Formulaire de connexion */}
            <form className="space-y-6">
              <div className="space-y-4">
                {/* Email Input - Based on comp-01 */}
                <div className="*:not-first:mt-2">
                  <Label htmlFor={emailId}>Adresse email</Label>
                  <Input 
                    id={emailId}
                    name="email"
                    type="email"
                    placeholder="votre.email@entreprise.com"
                    required
                    autoComplete="email"
                  />
                </div>

                {/* Password Input - Based on comp-23 */}
                <div className="*:not-first:mt-2">
                  <Label htmlFor={passwordId}>Mot de passe</Label>
                  <div className="relative">
                    <Input
                      id={passwordId}
                      name="password"
                      className="pe-9"
                      placeholder="Votre mot de passe"
                      type={isPasswordVisible ? "text" : "password"}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      className="text-muted-foreground/80 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-md transition-[color,box-shadow] outline-none focus:z-10 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                      type="button"
                      onClick={togglePasswordVisibility}
                      aria-label={isPasswordVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      aria-pressed={isPasswordVisible}
                      aria-controls={passwordId}
                    >
                      {isPasswordVisible ? (
                        <EyeOffIcon size={16} aria-hidden="true" />
                      ) : (
                        <EyeIcon size={16} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <Button
                formAction={login}
                className="w-full"
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