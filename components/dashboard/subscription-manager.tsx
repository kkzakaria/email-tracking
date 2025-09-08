"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Server, Activity, Clock, AlertTriangle } from "lucide-react";
import { FunctionsHttpError, FunctionsRelayError, FunctionsFetchError } from "@supabase/supabase-js";

interface SubscriptionStatus {
  active: boolean;
  count: number;
  subscriptions: Array<{
    id: string;
    resource: string;
    expires_at: string;
    status: string;
  }>;
  lastUpdate: string;
}

export function SubscriptionManager() {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const supabase = createClient();

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      // Log de debug
      console.log('Attempting to call subscription-manager function...');
      console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
      
      // Spécifier explicitement la méthode GET
      const { data, error } = await supabase.functions.invoke('subscription-manager', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      // Log complet de l'erreur si elle existe
      if (error) {
        console.error('Full error object:', error);
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        
        if (error instanceof FunctionsHttpError) {
          try {
            const errorMessage = await error.context.json();
            console.error('HTTP error details:', errorMessage);
            toast.error(`Erreur HTTP: ${errorMessage.message || 'Erreur inconnue'}`);
          } catch (e) {
            console.error('Could not parse error context:', e);
            toast.error(`Erreur HTTP: ${error.message}`);
          }
          return;
        } else if (error instanceof FunctionsRelayError) {
          console.error('Relay error:', error.message);
          toast.error(`Erreur de relay: ${error.message}`);
          return;
        } else if (error instanceof FunctionsFetchError) {
          console.error('Fetch error:', error.message);
          console.error('This usually indicates a network or configuration issue');
          toast.error(`Erreur de connexion: ${error.message}`);
          return;
        } else {
          console.error('Unknown error type:', error);
          toast.error('Erreur lors de la récupération du statut');
          return;
        }
      }

      console.log('Function response:', data);
      setStatus(data);
    } catch (error) {
      console.error('Caught exception:', error);
      toast.error('Erreur lors de la récupération du statut des subscriptions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (action: 'create' | 'renew' | 'cleanup') => {
    setActionLoading(action);
    try {
      // Log de debug pour les actions
      console.log(`Attempting to execute action: ${action}`);
      
      const { data, error } = await supabase.functions.invoke('subscription-manager', {
        body: { action },
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      // Log complet de l'erreur si elle existe
      if (error) {
        console.error(`Error in action ${action}:`, error);
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        
        if (error instanceof FunctionsHttpError) {
          try {
            const errorMessage = await error.context.json();
            console.error('HTTP error details:', errorMessage);
            toast.error(`Erreur HTTP: ${errorMessage.message || 'Erreur inconnue'}`);
          } catch (e) {
            console.error('Could not parse error context:', e);
            toast.error(`Erreur HTTP: ${error.message}`);
          }
          return;
        } else if (error instanceof FunctionsRelayError) {
          console.error('Relay error:', error.message);
          toast.error(`Erreur de relay: ${error.message}`);
          return;
        } else if (error instanceof FunctionsFetchError) {
          console.error('Fetch error:', error.message);
          toast.error(`Erreur de connexion: ${error.message}`);
          return;
        } else {
          console.error('Unknown error:', error);
          toast.error(`Erreur lors de l'action ${action}`);
          return;
        }
      }
      
      console.log(`Action ${action} response:`, data);
      
      // Messages de succès selon l'action
      const successMessages = {
        create: 'Subscription créée avec succès',
        renew: 'Subscriptions renouvelées avec succès',
        cleanup: 'Nettoyage des subscriptions terminé'
      };
      
      toast.success(successMessages[action]);
      
      // Rafraîchir le statut après l'action
      await fetchStatus();
    } catch (error) {
      console.error(`Caught exception in action ${action}:`, error);
      toast.error(`Erreur lors de l'action ${action}`);
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="ml-2">Chargement du statut...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statut Actuel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            Statut des Subscriptions
            {status?.active ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Actif
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                Inactif
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Gestion des notifications automatiques Microsoft Graph
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {status?.count || 0}
              </div>
              <div className="text-sm text-muted-foreground">
                Subscriptions actives
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                <Activity className="w-6 h-6 mx-auto" />
              </div>
              <div className="text-sm text-muted-foreground">
                Temps réel
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                <Clock className="w-6 h-6 mx-auto" />
              </div>
              <div className="text-sm text-muted-foreground">
                Auto-renouvelé
              </div>
            </div>
          </div>

          {status?.subscriptions && status.subscriptions.length > 0 && (
            <div className="space-y-2">
              <Separator />
              <h4 className="font-medium">Détails des subscriptions</h4>
              {status.subscriptions.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between text-sm bg-muted/50 rounded-lg p-3">
                  <div>
                    <div className="font-medium">{sub.resource}</div>
                    <div className="text-muted-foreground">ID: {sub.id.slice(0, 8)}...</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">Expire le</div>
                    <div className="text-muted-foreground">
                      {new Date(sub.expires_at).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions de Gestion */}
      <Card>
        <CardHeader>
          <CardTitle>Actions de Gestion</CardTitle>
          <CardDescription>
            Contrôlez vos subscriptions Microsoft Graph
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={() => handleAction('create')}
              disabled={actionLoading !== null}
              className="flex items-center gap-2 cursor-pointer"
              variant={status?.active ? "secondary" : "default"}
            >
              {actionLoading === 'create' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Server className="w-4 h-4" />
              )}
              Démarrer
            </Button>

            <Button
              onClick={() => handleAction('renew')}
              disabled={actionLoading !== null || !status?.active}
              className="flex items-center gap-2 cursor-pointer"
              variant="outline"
            >
              {actionLoading === 'renew' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Clock className="w-4 h-4" />
              )}
              Renouveler
            </Button>

            <Button
              onClick={() => handleAction('cleanup')}
              disabled={actionLoading !== null}
              className="flex items-center gap-2 cursor-pointer"
              variant="destructive"
            >
              {actionLoading === 'cleanup' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
              Arrêter
            </Button>
          </div>

          <div className="mt-4 text-sm text-muted-foreground space-y-1">
            <p><strong>Démarrer :</strong> Crée une nouvelle subscription pour recevoir les notifications</p>
            <p><strong>Renouveler :</strong> Prolonge les subscriptions existantes avant expiration</p>
            <p><strong>Arrêter :</strong> Supprime toutes les subscriptions actives</p>
          </div>
        </CardContent>
      </Card>

      {/* Dernière mise à jour */}
      {status?.lastUpdate && (
        <div className="text-center text-sm text-muted-foreground">
          Dernière mise à jour : {new Date(status.lastUpdate).toLocaleString('fr-FR')}
        </div>
      )}
    </div>
  );
}