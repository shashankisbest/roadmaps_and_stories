from django.apps import AppConfig
from importlib import import_module


class UsersConfig(AppConfig):
    name = 'users'

    def ready(self):
        import_module("users.signals")
