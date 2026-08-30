export interface ZaloConfig {
  appId: string;
  appSecret: string;
  callbackUrl?: string;
}

export interface ZaloUser {
  id: string;
  name: string;
  avatar?: string;
  phone?: string;
  birthday?: string;
  gender?: string;
}

export interface ZaloShareData {
  title: string;
  description?: string;
  imageUrl: string;
  url: string;
  buttonText?: string;
}

export interface ZaloOAConfig {
  accessToken: string;
  refreshToken?: string;
  appId?: string;
}
