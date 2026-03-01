from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Chalkboard Auth"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    
    # DB
    POSTGRES_SERVER: str = "db"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "chalkboard"
    POSTGRES_PORT: str = "5432"

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    # SMTP2GO Config
    SMTP_HOST: str = "mail.smtp2go.com"
    SMTP_PORT: int = 2525
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAILS_FROM_EMAIL: str = "invite@chalkboard.ose.land"
    EMAILS_FROM_NAME: str = "Chalkboard Invites"
    
    # JWT
    JWT_SECRET_KEY: str = "super_secret_override_me_in_prod"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    FRONTEND_URL: str = "http://localhost:5173"
    
    # Phase 3: AI
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "google/gemini-2.5-flash"
    
    # Image Generation
    STABILITY_API_KEY: str = ""
    BFL_API_KEY: str = ""
    PEXELS_API_KEY: str = ""
    
    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env", extra="ignore")

settings = Settings()
