#!/bin/bash

# Script de build para o projeto BPMN Visualizador

echo "🔨 Iniciando build do projeto BPMN Visualizador..."

# Compila TypeScript
echo "📦 Compilando TypeScript..."
npx tsc

# Copia arquivos estáticos
echo "📋 Copiando arquivos estáticos..."
cp -r src/styles dist/ 2>/dev/null || echo "Styles já copiados"

# Verifica se os arquivos foram criados
echo "✅ Verificando arquivos gerados..."
if [ -f "dist/main.js" ]; then
    echo "✅ main.js criado com sucesso"
else
    echo "❌ Erro: main.js não foi gerado"
fi

if [ -f "dist/styles/main.css" ]; then
    echo "✅ CSS copiado com sucesso"
else
    echo "❌ Erro: CSS não foi copiado"
fi

echo "🎯 Build concluído!"
echo "📂 Arquivos gerados em /dist:"
ls -la dist/

echo ""
echo "🚀 Para iniciar o servidor:"
echo "python -m http.server 8000"
