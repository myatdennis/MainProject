let authState: any = {
  user: null
};

export function setAuthState(newState: any) {
  authState = newState;
}

export function getAuthState() {
  return authState;
}