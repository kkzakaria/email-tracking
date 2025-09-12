"use client"

import { useState, useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { 
  Clock, 
  RefreshCw, 
  Settings, 
  Mail, 
  Calendar,
  Users,
  TrendingUp,
  Plus,
  X,
  AlertCircle,
  CheckCircle,
  Timer
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"

const formSchema = z.object({
  enabled: z.boolean(),
  maxReminders: z.number().min(1).max(10),
  businessDaysOnly: z.boolean(),
  startHour: z.number().min(0).max(23),
  endHour: z.number().min(0).max(23),
  delays: z.array(z.object({
    value: z.number(),
    unit: z.enum(["hours", "days", "weeks"]),
    label: z.string(),
  })),
})

type FormValues = z.infer<typeof formSchema>

const defaultDelays = [
  { value: 24, unit: "hours" as const, label: "1 jour" },
  { value: 3, unit: "days" as const, label: "3 jours" },
  { value: 1, unit: "weeks" as const, label: "1 semaine" },
]

export function RemindersSettings() {
  const [excludedDomains, setExcludedDomains] = useState([
    "example.com", 
    "noreply.com",
    "spam-domain.net"
  ])
  const [newDomain, setNewDomain] = useState("")
  const [excludedEmails, setExcludedEmails] = useState([
    "admin@company.com",
    "support@service.com"
  ])
  const [newEmail, setNewEmail] = useState("")

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      enabled: true,
      maxReminders: 3,
      businessDaysOnly: true,
      startHour: 9,
      endHour: 18,
      delays: defaultDelays,
    },
  })

  const onSubmit = (values: FormValues) => {
    console.log("Configuration des relances:", values)
    // TODO: Sauvegarder la configuration
  }

  const addExcludedDomain = () => {
    if (newDomain && !excludedDomains.includes(newDomain)) {
      setExcludedDomains([...excludedDomains, newDomain])
      setNewDomain("")
    }
  }

  const removeExcludedDomain = (domain: string) => {
    setExcludedDomains(excludedDomains.filter(d => d !== domain))
  }

  const addExcludedEmail = () => {
    if (newEmail && !excludedEmails.includes(newEmail)) {
      setExcludedEmails([...excludedEmails, newEmail])
      setNewEmail("")
    }
  }

  const removeExcludedEmail = (email: string) => {
    setExcludedEmails(excludedEmails.filter(e => e !== email))
  }

  // État pour les templates avec tous les templates possibles
  const [templates, setTemplates] = useState({
    first: "Bonjour {{nom}},\n\nJe me permets de relancer concernant mon email précédent.\n\nPourriez-vous me faire savoir si vous avez eu l'occasion de le consulter ?\n\nCordialement,\n{{signature}}",
    second: "Bonjour {{nom}},\n\nJe reviens vers vous concernant ma demande du {{date}}.\n\nSerait-il possible d'avoir un retour de votre part ?\n\nMerci pour votre attention.\n\n{{signature}}",
    third: "Bonjour {{nom}},\n\nTroisième tentative concernant {{sujet}}. J'aimerais vraiment avoir votre retour sur cette proposition.\n\nCordialement,\n{{signature}}",
    fourth: "Bonjour {{nom}},\n\nQuatrième relance concernant {{sujet}}. Une réponse même négative m'aiderait à comprendre votre position.\n\nCordialement,\n{{signature}}",
    final: "Bonjour {{nom}},\n\nC'est ma dernière relance concernant {{sujet}}.\n\nSi vous n'êtes pas la bonne personne, pourriez-vous me rediriger ?\n\nMerci,\n{{signature}}"
  })

  // Fonction pour générer le libellé d'un onglet de template
  const generateTemplateLabel = (index: number, total: number) => {
    if (total === 1) return "Relance unique"
    if (index === total) return "Dernière relance"
    if (index === 1) return "1ère relance"
    if (index === 2) return "2ème relance"
    return `${index}ème relance`
  }

  // Fonction pour obtenir la clé de template appropriée
  const getTemplateKey = (index: number, total: number): keyof typeof templates => {
    if (total === 1) return "first"
    if (index === total && total > 1) return "final"
    const keys: (keyof typeof templates)[] = ["first", "second", "third", "fourth", "final"]
    return keys[index - 1] || "final"
  }

  // Observer les changements du nombre de relances pour réinitialiser l'onglet actif si nécessaire  
  const maxReminders = form.watch("maxReminders")
  const [activeTemplateTab, setActiveTemplateTab] = useState("1")

  // Fonction pour obtenir la classe CSS appropriée pour la grille
  const getGridColsClass = (count: number) => {
    const classes = {
      1: "grid-cols-1",
      2: "grid-cols-2", 
      3: "grid-cols-3",
      4: "grid-cols-4",
      5: "grid-cols-5"
    }
    return classes[count as keyof typeof classes] || "grid-cols-3"
  }

  // Effect pour réinitialiser l'onglet actif si nécessaire quand le nombre de relances change
  useEffect(() => {
    const currentTab = parseInt(activeTemplateTab)
    if (currentTab > maxReminders) {
      setActiveTemplateTab("1")
    }
  }, [maxReminders, activeTemplateTab])

  return (
    <div className="space-y-6">
      {/* Configuration générale */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configuration générale
          </CardTitle>
          <CardDescription>
            Paramètres principaux des relances automatiques
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Activation des relances */}
                <FormField
                  control={form.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base flex items-center gap-2">
                          <RefreshCw className="w-4 h-4" />
                          Relances automatiques
                        </FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Activer l'envoi automatique de relances
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Nombre maximum de relances */}
                <FormField
                  control={form.control}
                  name="maxReminders"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Timer className="w-4 h-4" />
                        Nombre maximum de relances
                      </FormLabel>
                      <FormControl>
                        <Select
                          value={field.value.toString()}
                          onValueChange={(value) => field.onChange(parseInt(value))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5].map((num) => (
                              <SelectItem key={num} value={num.toString()}>
                                {num} relance{num > 1 ? 's' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Jours ouvrables uniquement */}
                <FormField
                  control={form.control}
                  name="businessDaysOnly"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Jours ouvrables uniquement
                        </FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Envoyer les relances du lundi au vendredi
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Heures d'envoi */}
                <div className="space-y-4">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Heures d'envoi
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="startHour"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Heure de début</FormLabel>
                          <FormControl>
                            <Select
                              value={field.value.toString()}
                              onValueChange={(value) => field.onChange(parseInt(value))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 24 }, (_, i) => (
                                  <SelectItem key={i} value={i.toString()}>
                                    {i.toString().padStart(2, '0')}:00
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="endHour"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Heure de fin</FormLabel>
                          <FormControl>
                            <Select
                              value={field.value.toString()}
                              onValueChange={(value) => field.onChange(parseInt(value))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 24 }, (_, i) => (
                                  <SelectItem key={i} value={i.toString()}>
                                    {i.toString().padStart(2, '0')}:00
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Délais de relance */}
              <div className="space-y-4">
                <div className="text-sm font-medium flex items-center gap-2">
                  <Timer className="w-4 h-4" />
                  Délais de relance
                </div>
                <div className="flex flex-wrap gap-2">
                  {form.watch("delays").map((delay, index) => (
                    <Badge key={index} variant="secondary" className="px-3 py-1">
                      {delay.label}
                    </Badge>
                  ))}
                </div>
              </div>

              <Button type="submit" className="w-full">
                <CheckCircle className="w-4 h-4 mr-2" />
                Sauvegarder la configuration
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Exclusions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Domaines exclus */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Domaines exclus
            </CardTitle>
            <CardDescription>
              Domaines qui ne recevront jamais de relances
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="example.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addExcludedDomain()}
              />
              <Button onClick={addExcludedDomain} size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <ScrollArea className="h-32">
              <div className="space-y-2">
                {excludedDomains.map((domain, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{domain}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeExcludedDomain(domain)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Emails exclus */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Emails exclus
            </CardTitle>
            <CardDescription>
              Adresses email spécifiques à exclure
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="admin@company.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addExcludedEmail()}
              />
              <Button onClick={addExcludedEmail} size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <ScrollArea className="h-32">
              <div className="space-y-2">
                {excludedEmails.map((email, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{email}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeExcludedEmail(email)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Templates de relance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Templates de relance
          </CardTitle>
          <CardDescription>
            Personnalisez vos messages de relance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTemplateTab} onValueChange={setActiveTemplateTab}>
            <TabsList className={`grid w-full ${getGridColsClass(maxReminders)}`}>
              {Array.from({ length: maxReminders }, (_, i) => i + 1).map((index) => (
                <TabsTrigger key={index} value={index.toString()}>
                  {generateTemplateLabel(index, maxReminders)}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {Array.from({ length: maxReminders }, (_, i) => i + 1).map((index) => {
              const templateKey = getTemplateKey(index, maxReminders)
              return (
                <TabsContent key={index} value={index.toString()} className="space-y-4">
                  <Textarea 
                    value={templates[templateKey]}
                    onChange={(e) => setTemplates(prev => ({ ...prev, [templateKey]: e.target.value }))}
                    placeholder={`Template ${generateTemplateLabel(index, maxReminders).toLowerCase()}`}
                    className="min-h-32"
                  />
                  <div className="text-xs text-muted-foreground">
                    Variables disponibles : {"{nom}"}, {"{entreprise}"}, {"{date}"}, {"{sujet}"}, {"{signature}"}
                  </div>
                </TabsContent>
              )
            })}
          </Tabs>
        </CardContent>
      </Card>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="w-4 h-4" />
              Taux de réponse global
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">67%</div>
              <Progress value={67} className="h-2" />
              <div className="text-xs text-muted-foreground">
                +5% par rapport au mois dernier
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <RefreshCw className="w-4 h-4" />
              Relances envoyées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">1,247</div>
              <div className="text-xs text-muted-foreground">
                Ce mois-ci
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4" />
              Efficacité moyenne
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">2.3</div>
              <div className="text-xs text-muted-foreground">
                relances avant réponse
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conseils d'optimisation */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Conseil :</strong> Les relances envoyées le mardi entre 10h et 15h ont 23% plus de chance d'obtenir une réponse.
          Considérez ajuster vos horaires d'envoi pour optimiser vos résultats.
        </AlertDescription>
      </Alert>
    </div>
  )
}