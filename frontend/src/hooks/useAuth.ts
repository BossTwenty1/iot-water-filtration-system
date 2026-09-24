import { useSyncExternalStore } from 'react'
import { getAuthState,subscribeAuth } from '../services/apiClient'

export function useAuth(){return useSyncExternalStore(subscribeAuth,getAuthState,getAuthState)}
