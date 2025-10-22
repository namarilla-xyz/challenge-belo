Resumen del challenge

**Que se hizo?**
Implementé dos estrategias de despliegue en Kubernetes usando Minikube: **Blue/Green** para cambiar de versión sin downtime y **Canary** para liberar cambios de forma gradual.

**Cómo lo armé**

* Construí dos versiones mínimas de una app Node.js: **v1 (blue)** y **v2 (green)**. Cada una responde su versión para verificar a dónde va el tráfico.
* Organicé los manifiestos en carpetas claras: **base/** (namespace, service, ingress), **blue-green/** y **canary/**.
* Construí las imágenes **dentro de Minikube** con `minikube image build` para evitar usar un registry externo.

**Qué demostré**

* **Blue/Green:** Mantengo dos Deployments (blue y green) y un Service que apunta a pods con `role=active`. Cuando quiero pasar a la nueva versión, **cambio el label** y todo el tráfico va a green sin cortar servicio. Si algo falla, **hago rollback** invirtiendo el label.
* **Canary:** Trabajo con dos Deployments (stable y canary) detrás del mismo Service. **Regulo el porcentaje** de tráfico ajustando la cantidad de réplicas (ej. 90/10 → 75/25 → 50/50) y, si todo va bien, **promuevo** cambiando la imagen de stable a v2 y escalando canary a 0. Si necesito volver atrás, bajo canary y restauro la imagen estable a v1.

**Cómo validé**

* Verifiqué estado y ruteo con `kubectl get pods -L role,track,color` y revisé **logs por deployment**.
* Corrí un **smoke test** con k6 para generar tráfico y observar la distribución entre versiones.

**Resultado**
Entregué una solución **simple, reproducible y con rollback inmediato**, que muestra claramente cómo hacer despliegues **sin downtime** (Blue/Green) y **progresivos** (Canary) en Kubernetes.

Debajo dejo las instrucciones para poder probar el challenge.

## 1) Lo que debería existir

* App de ejemplo:

  * `services/app-blue` (v1) y `services/app-green` (v2), cada una con `Dockerfile` y `server.js`.
* Manifiestos K8s:

  * `k8s/namespace.yml`
  * `k8s/base/{service.yml, ingress.yml}`
  * `k8s/blue-green/{deploy-blue.yml, deploy-green.yml}`
  * `k8s/canary/{deploy-stable.yml, deploy-canary.yml}`
* Prueba rápida: `load/smoke.js` (k6).

---

## 2) Poner todo en marcha (lo mínimo)

```bash
minikube start --driver=docker
minikube addons enable ingress   # opcional
minikube image build -t app-blue:1.0  ./services/app-blue
minikube image build -t app-green:2.0 ./services/app-green
kubectl apply -f k8s/namespace.yml
kubectl apply -f k8s/base/service.yml
# si usás Ingress:
kubectl apply -f k8s/base/ingress.yml
```

**Probar URL:**

```bash
minikube service -n deploy-strategies web-svc --url
# o, con Ingress:
echo "$(minikube ip) web.local" | sudo tee -a /etc/hosts
curl http://web.local
```

---

## 3) Blue/Green rápido

1. Deploy de v1 (blue) y v2 (green):

```bash
kubectl apply -f k8s/blue-green/deploy-blue.yml    # role=active
kubectl apply -f k8s/blue-green/deploy-green.yml   # role=inactive
```

2. Cambiar el tráfico a green (sin downtime) y volver atrás si hace falta:

```bash
# promover green
kubectl -n deploy-strategies patch deploy/web-green -p '{"spec":{"template":{"metadata":{"labels":{"role":"active"}}}}}'
kubectl -n deploy-strategies patch deploy/web-blue  -p '{"spec":{"template":{"metadata":{"labels":{"role":"inactive"}}}}}'
# rollback = invertir esos dos parches
```

---

## 4) Canary (reparto simple por réplicas)

```bash
kubectl apply -f k8s/canary/deploy-stable.yml     # v1 (más réplicas)
kubectl apply -f k8s/canary/deploy-canary.yml     # v2 (menos réplicas)

# subir gradualmente el peso del canary (ej. ~25%)
kubectl -n deploy-strategies scale deploy/web-canary --replicas=3
kubectl -n deploy-strategies scale deploy/web-stable --replicas=9

# promover a 100%
kubectl -n deploy-strategies set image deploy/web-stable app=app-green:2.0
kubectl -n deploy-strategies scale deploy/web-canary --replicas=0
```

**Rollback rápido:** bajar canary a 0 y volver la imagen estable a `app-blue:1.0`.

---

## 5) Ver que realmente pasa

```bash
# ver pods y labels
kubectl -n deploy-strategies get pods -L role,track,color

# logs por versión
kubectl -n deploy-strategies logs deploy/web-blue  --tail=10
kubectl -n deploy-strategies logs deploy/web-green --tail=10

# smoke test (opcional)
TARGET=$(minikube service -n deploy-strategies web-svc --url) k6 run load/smoke.js
```

---

## 6) Qué chequear para aprobar

* **Blue/Green:** el Service apunta al `role=active`. Cambiar de blue→green no corta tráfico y se puede **rollbackear** en 2 comandos.
* **Canary:** el tráfico se reparte por cantidad de réplicas; se puede **promover** y **volver atrás** sin dramas.
* **Imágenes:** se construyen dentro de Minikube con `minikube image build`.
* **Manifiestos:** están separados por **base**, **blue-green** y **canary**, fáciles de leer.
