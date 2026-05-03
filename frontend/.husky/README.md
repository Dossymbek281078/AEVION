# Husky pre-commit hooks

Pre-commit setup for `frontend-exchange/frontend`. Husky 9 + lint-staged
config готовы — нужен один разовый шаг для активации:

```bash
# from repo root (C:\Users\user\aevion-core\frontend-exchange)
git config core.hooksPath frontend/.husky
```

После этого каждый `git commit` запускает `lint-staged` (eslint --fix
на staged .ts/.tsx файлах). Bypass: `git commit --no-verify`.

Чтобы откатить:
```bash
git config --unset core.hooksPath
```

Note: Husky 9 deprecated `husky install`; рекомендуется
`core.hooksPath` (см. https://typicode.github.io/husky/get-started.html).
Мы НЕ автоматизируем это в `npm install` (через `prepare` script),
потому что repo root не совпадает с npm cwd, и нам не следует менять
git config за пользователя.
