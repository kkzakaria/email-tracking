"use client"

import { useState, useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import {
  Clock,
  Plus,
  X,
  Mail,
  Settings,
  Timer,
  CheckCircle,
  PlayCircle,
  AlertCircle,
  Calendar
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Types pour la configuration
interface DelayConfig {
  value: number
  unit: 'hours' | 'days' | 'weeks'
  label: string
}

interface ReminderConfig {
  enabled: boolean
  delays: DelayConfig[]
  templates: {
    [key: string]: string
  }
  work_hours: {
    start: string
    end: string
  }
  work_days: string[]
  max_reminders: number
}

const formSchema = z.object({
  enabled: z.boolean(),
  max_reminders: z.number().min(1).max(10),
  work_start: z.string(),
  work_end: z.string(),
  work_days: z.array(z.string()),
})

type FormValues = z.infer<typeof formSchema>

const DEFAULT_CONFIG: ReminderConfig = {
  enabled: true,
  delays: [
    { value: 2, unit: 'days', label: '2 jours' },
    { value: 1, unit: 'weeks', label: '1 semaine' },
    { value: 2, unit: 'weeks', label: '2 semaines' }
  ],
  templates: {
    '1': 'Bonjour {{nom}},\n\nJ\'espère que vous allez bien. Je reviens vers vous concernant mon message du {{date_envoi}} au sujet de "{{sujet}}".\n\nN\'ayant pas eu de retour de votre part depuis {{jours_ecoules}} jours, je souhaitais m\'assurer que vous avez bien reçu mon message.\n\nMerci de votre attention.\n\nCordialement',
    '2': 'Bonjour {{nom}},\n\nJe me permets de relancer concernant mon email du {{date_envoi}} sur "{{sujet}}".\n\nSi vous avez besoin d\'informations complémentaires, n\'hésitez pas à me le faire savoir.\n\nCordialement',
    'final': 'Bonjour {{nom}},\n\nDernière relance concernant "{{sujet}}".\n\nSi ce message ne vous concerne pas ou si vous préférez ne pas donner suite, merci de me le faire savoir.\n\nCordialement'
  },
  work_hours: {
    start: '09:00',
    end: '18:00'
  },
  work_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  max_reminders: 3
}

export function ReminderConfiguration() {
  const [config, setConfig] = useState<ReminderConfig>(DEFAULT_CONFIG)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      enabled: config.enabled,
      max_reminders: config.max_reminders,
      work_start: config.work_hours.start,
      work_end: config.work_hours.end,
      work_days: config.work_days,
    },
  })

  // Fonction pour ajouter un délai
  const addDelay = () => {
    const newDelay: DelayConfig = {
      value: 1,
      unit: 'weeks',
      label: '1 semaine'
    }
    setConfig(prev => ({
      ...prev,
      delays: [...prev.delays, newDelay]
    }))
  }

  // Fonction pour supprimer un délai
  const removeDelay = (index: number) => {
    setConfig(prev => ({
      ...prev,
      delays: prev.delays.filter((_, i) => i !== index)
    }))
  }

  // Fonction pour modifier un délai
  const updateDelay = (index: number, field: keyof DelayConfig, value: any) => {
    setConfig(prev => ({
      ...prev,
      delays: prev.delays.map((delay, i) => {
        if (i === index) {
          const updated = { ...delay, [field]: value }
          // Mettre à jour le label automatiquement
          if (field === 'value' || field === 'unit') {
            updated.label = `${updated.value} ${updated.unit === 'hours' ? (updated.value > 1 ? 'heures' : 'heure') :
              updated.unit === 'days' ? (updated.value > 1 ? 'jours' : 'jour') :
              updated.value > 1 ? 'semaines' : 'semaine'}`
          }
          return updated
        }
        return delay
      })
    }))
  }

  // Fonction pour modifier un template
  const updateTemplate = (key: string, content: string) => {
    setConfig(prev => ({
      ...prev,
      templates: {
        ...prev.templates,
        [key]: content
      }
    }))
  }

  // Fonction pour sauvegarder la configuration
  const saveConfiguration = async (values: FormValues) => {
    setIsSaving(true)
    try {
      const updatedConfig: ReminderConfig = {
        ...config,
        enabled: values.enabled,
        max_reminders: values.max_reminders,
        work_hours: {
          start: values.work_start,
          end: values.work_end
        },
        work_days: values.work_days
      }

      // TODO: Appeler l'API pour sauvegarder la configuration
      console.log('Sauvegarde de la configuration:', updatedConfig)

      // Simulation d'un délai
      await new Promise(resolve => setTimeout(resolve, 1000))

      setConfig(updatedConfig)
      console.log('✅ Configuration sauvegardée avec succès')

    } catch (error) {
      console.error('❌ Erreur sauvegarde configuration:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Fonction pour tester les relances
  const testReminders = async () => {
    try {
      console.log('🧪 Test des relances en cours...')
      // TODO: Appeler l'Edge Function pour tester
      // await supabase.functions.invoke('email-reminder', {
      //   body: { action: 'test', target_email_ids: [] }
      // })
    } catch (error) {
      console.error('❌ Erreur test relances:', error)
    }
  }

  // Fonction pour obtenir la clé de template appropriée
  const getTemplateKey = (index: number): string => {
    if (index === config.max_reminders) return 'final'
    return (index + 1).toString()
  }

  // Fonction pour obtenir le libellé du template
  const getTemplateLabel = (index: number): string => {
    if (config.max_reminders === 1) return 'Relance unique'
    if (index === config.max_reminders - 1) return 'Dernière relance'
    if (index === 0) return '1ère relance'
    if (index === 1) return '2ème relance'
    return `${index + 1}ème relance`
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Relances automatiques
          </h3>
          <p className="text-sm text-muted-foreground">
            Configuration des relances et templates personnalisables
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={config.enabled ? "default" : "secondary"}>
            {config.enabled ? "Activé" : "Désactivé"}
          </Badge>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(saveConfiguration)} className="space-y-6">

          {/* Configuration générale */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Configuration générale
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Activation des relances */}
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Activer les relances automatiques
                      </FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Envoi automatique de relances pour les emails sans réponse
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked)
                          setConfig(prev => ({ ...prev, enabled: checked }))
                        }}
                        className="cursor-pointer"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nombre maximum de relances */}
                <FormField
                  control={form.control}
                  name="max_reminders"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Timer className="w-4 h-4" />
                        Nombre maximum de relances
                      </FormLabel>
                      <FormControl>
                        <Select
                          value={field.value.toString()}
                          onValueChange={(value) => {
                            const num = parseInt(value)
                            field.onChange(num)
                            setConfig(prev => ({ ...prev, max_reminders: num }))
                          }}
                        >
                          <SelectTrigger className="cursor-pointer">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
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

                {/* Heures de travail */}
                <div className="space-y-2">
                  <FormLabel className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Heures d'envoi
                  </FormLabel>
                  <div className="grid grid-cols-2 gap-2">
                    <FormField
                      control={form.control}
                      name="work_start"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="time"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e.target.value)
                                setConfig(prev => ({
                                  ...prev,
                                  work_hours: { ...prev.work_hours, start: e.target.value }
                                }))
                              }}
                              className="cursor-pointer"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="work_end"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="time"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e.target.value)
                                setConfig(prev => ({
                                  ...prev,
                                  work_hours: { ...prev.work_hours, end: e.target.value }
                                }))
                              }}
                              className="cursor-pointer"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Jours de la semaine */}
              <div className="space-y-2">
                <FormLabel className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Jours d'envoi
                </FormLabel>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'monday', label: 'Lundi' },
                    { key: 'tuesday', label: 'Mardi' },
                    { key: 'wednesday', label: 'Mercredi' },
                    { key: 'thursday', label: 'Jeudi' },
                    { key: 'friday', label: 'Vendredi' },
                    { key: 'saturday', label: 'Samedi' },
                    { key: 'sunday', label: 'Dimanche' }
                  ].map(day => {
                    const isSelected = config.work_days.includes(day.key)
                    return (
                      <Badge
                        key={day.key}
                        variant={isSelected ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          const newWorkDays = isSelected
                            ? config.work_days.filter(d => d !== day.key)
                            : [...config.work_days, day.key]
                          setConfig(prev => ({ ...prev, work_days: newWorkDays }))
                          form.setValue('work_days', newWorkDays)
                        }}
                      >
                        {day.label}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Configuration des délais */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Timer className="w-4 h-4" />
                Délais des relances
              </CardTitle>
              <CardDescription>
                Configurez quand envoyer chaque relance après l'email initial
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {config.delays.map((delay, index) => (
                <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-sm font-medium w-24">
                      Relance {index + 1}:
                    </span>
                    <Input
                      type="number"
                      value={delay.value}
                      onChange={(e) => updateDelay(index, 'value', parseInt(e.target.value) || 1)}
                      className="w-20 cursor-pointer"
                      min="1"
                    />
                    <Select
                      value={delay.unit}
                      onValueChange={(value: 'hours' | 'days' | 'weeks') =>
                        updateDelay(index, 'unit', value)
                      }
                    >
                      <SelectTrigger className="w-28 cursor-pointer">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hours">Heure{delay.value > 1 ? 's' : ''}</SelectItem>
                        <SelectItem value="days">Jour{delay.value > 1 ? 's' : ''}</SelectItem>
                        <SelectItem value="weeks">Semaine{delay.value > 1 ? 's' : ''}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDelay(index)}
                    className="cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={addDelay}
                className="w-full cursor-pointer"
              >
                <Plus className="w-4 h-4 mr-2" />
                Ajouter un délai
              </Button>
            </CardContent>
          </Card>

          {/* Templates de messages */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Templates de relance
              </CardTitle>
              <CardDescription>
                Personnalisez vos messages de relance avec des variables dynamiques
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="0" className="w-full">
                <TabsList className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1">
                  {Array.from({ length: config.max_reminders }, (_, i) => (
                    <TabsTrigger key={i} value={i.toString()} className="cursor-pointer">
                      {getTemplateLabel(i)}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {Array.from({ length: config.max_reminders }, (_, i) => {
                  const templateKey = getTemplateKey(i)
                  return (
                    <TabsContent key={i} value={i.toString()} className="space-y-4">
                      <Textarea
                        value={config.templates[templateKey] || ''}
                        onChange={(e) => updateTemplate(templateKey, e.target.value)}
                        placeholder={`Template pour la ${getTemplateLabel(i).toLowerCase()}`}
                        className="min-h-32"
                      />
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Variables disponibles :</strong> {"{nom}"}, {"{sujet}"}, {"{date_envoi}"}, {"{jours_ecoules}"}, {"{numero_relance}"}, {"{expediteur}"}
                        </AlertDescription>
                      </Alert>
                    </TabsContent>
                  )
                })}
              </Tabs>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={testReminders}
              className="cursor-pointer"
            >
              <PlayCircle className="w-4 h-4 mr-2" />
              Tester les relances
            </Button>

            <Button
              type="submit"
              disabled={isSaving}
              className="cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Timer className="w-4 h-4 mr-2 animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Sauvegarder la configuration
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}