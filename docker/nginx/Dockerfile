FROM nginx:1.27-alpine

# O template usa ${WEB_DOMAIN}/${ADMIN_DOMAIN}: a imagem do nginx expande
# variáveis de arquivos em /etc/nginx/templates no boot. Como aqui o template
# é o nginx.conf inteiro (e não um server block), a substituição é feita no
# entrypoint próprio abaixo.
COPY nginx.conf.template /etc/nginx/nginx.conf.template
COPY docker-entrypoint.sh /docker-entrypoint-custom.sh

RUN chmod +x /docker-entrypoint-custom.sh

ENV WEB_DOMAIN=rapidinhoentrega.com.br \
    ADMIN_DOMAIN=painel.rapidinhoentrega.com.br

EXPOSE 80 443

ENTRYPOINT ["/docker-entrypoint-custom.sh"]
CMD ["nginx", "-g", "daemon off;"]
