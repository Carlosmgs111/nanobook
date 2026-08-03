---
title: "Roadmap"
description: "Roadmap para el desarrollo de Nanobook."
date: 2026-07-30
author: "Astro"
tags: []
draft: false
index: false
---

# Roadmap

El siguiente es un roadmap para el desarrollo de Nanobook.

- [ ] Añadir navegacion transversal, no depender unicamente de los indices, aplicar botones auxiliares contextuales:
    - [ ] Boton para navegar a documento anterior
    - [ ] Boton para navegar a documento siguiente
    - [ ] Boton para navegar a directorio superior
- [ ] Añadir opcion para varios idiomas
    - [x] Español (por defecto)
    - [ ] Inglés
- [ ] Añadir mas funcionalidades activables via frontmatter
    - [ ] Cambiar espaciado de interlinea en bloque de codigo
- [ ] Añadir estilos para los bloque anidados usando la jerarquia implicita de los headers
    ```markdown
    ## Bloque 1

    ### Bloque 1.1 

        <!-- Este bloque deberia indicar visualmente que pertence al bloque 1 -->

    ## Bloque 2

    ### Bloque 2.1
    
        <!-- Este bloque deberia indicar visualmente que pertence al bloque 2 -->
    ```
- [ ] Agregar componente de navegacion intrapagina
- [ ] Iniciar integracion para soporte de insercion de componentes con 'remark'

## Modelo de negocio