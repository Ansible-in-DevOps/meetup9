# AiDO Meetup #9 with Tomasz Cholewa (https://cloudowski.com): Build and manage NodeJS app using GitLab on GKE

Date:
Place: online
Link:
Organizer: Tomasz Cholewa
Sperakers: Radosław Zduński and Grzegorz Bołtuć from AiDO Meetup

## Useful links

1. https://google.qwiklabs.com/ -> Introduction to GitLab on GKE
2. 
3. GitLab runner: https://docs.gitlab.com/runner/


## Preparation

Steps before Meetup on your GCP account.

1. Create a new project.
2. Go to IAM & Admin -> Quotas -> CPU over 15, 50GB RAM, 300GB SSD in your region/zone.
From GCP Cloud Shell run:

```bash
gcloud config list
```

Copy Project ID and check your limits. GitLab on GKE needs 12 CPU, 45GB RAM and 300GB SSD.  

```bash
gcloud compute project-info describe --project $PROJECT_ID
```

Check if apis are enabled.

```bash
gcloud services list --enabled | grep compute.googleapis.com
gcloud services list --enabled | grep container.googleapis.com

```

```bash
gcloud container clusters create gitlab-gke-aido --cluster-version=1.16 --num-nodes=3 --machine-type=n1-standard-4 --disk-type "pd-ssd" --disk-size "100" --zone europe-west3-b
gcloud container clusters get-credentials gitlab-gke-aido --zone europe-west3-b
```

Or if you don't have enough resources below.

```bash
gcloud container clusters create gitlab-gke-aido --cluster-version=1.16 --num-nodes=3 --machine-type=n1-standard-2 --disk-type "pd-ssd" --disk-size "20" --zone europe-west3-b
gcloud container clusters get-credentials gitlab-gke-aido --zone europe-west3-b
```

## Install GitLab using Helm 3 on GKE

Install Helm 3 on GCP Cloud Shell

```bash
curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/master/scripts/get-helm-3
chmod 700 get_helm.sh
./get_helm.sh
```

Get IP and e-mail.

```bash
gcloud compute addresses create endpoints-ip --region europe-west3
gcloud compute addresses list
export LB_IP_ADDR="$(gcloud compute addresses list | tail -1 | awk '/endpoints-ip/ {print$2}')"; echo "LB_IP_ADDR=${LB_IP_ADDR}"  #should be 1 IP address
nslookup ${LB_IP_ADDR}.nip.io
export EMAIL="$(gcloud auth list 2> /dev/null | awk '/^\*/ {print $2}')"; echo $EMAIL
```

Install GitLab 13.3.5

```bash
helm repo add gitlab https://charts.gitlab.io/
helm repo update
helm upgrade --install gitlab gitlab/gitlab                    \
             --version 4.3.5                                   \
             --timeout 600s                                     \
             --set global.hosts.externalIP=${LB_IP_ADDR}       \
             --set global.hosts.domain=${LB_IP_ADDR}.nip.io    \
             --set gitlab-runner.runners.privileged=true       \
             --set certmanager-issuer.email=${EMAIL}
```

Wait 5-10 min to starting pods.
If unicorn is running, you can login to Web.

```bash
kubectl get pods
echo; echo "https://gitlab.${LB_IP_ADDR}.nip.io"; echo
```

## Setup GitLab

1. Initial data to GitLab portal.
- user: root
- password from secret
- GitLab education License Key

```bash
echo; kubectl get secret gitlab-gitlab-initial-root-password -ojsonpath={.data.password} | base64 --decode ; echo; echo
echo; curl https://gitlab.com/gitlab-workshops/gitlab-on-gke-gnext/raw/master/gitlab-on-gke/gitlab.license; echo; echo
```

2. Go to admin area.
3. Find **License** section and **Upload New License**.
4. Go to Kubernetes section. Next Add existing cluster.

```bash
echo; kubectl cluster-info | awk '/Kubernetes master/ {print $NF}'; echo #API URL
echo; kubectl get secret $(kubectl get secrets | grep default-token| awk '{print $1}') -o jsonpath="{['data']['ca\.crt']}" | base64 --decode; echo; echo
kubectl create serviceaccount -n default gitlab
kubectl create clusterrolebinding gitlab-cluster-admin --serviceaccount default:gitlab --clusterrole=cluster-admin
echo; kubectl -n default get secret $(kubectl -n default get secrets| awk '/^gitlab-token/ {print $1}') -o jsonpath="{['data']['token']}" | base64 --decode; echo; echo
```

5. Install **Ingress** and **Prometheus** to your GKE. GKE section.
6. Add Base domain GKE information in GitLab (DNS name). GKE section. ->  gitlab.{LB_IP_ADDR}.nip.io
7. Install GitLab Runner using GCP Cloud Shell.

   7.1. Get certificate from your Web page gitlab.{LB_IP_ADDR}.nip.io 
   
   ```bash
   echo | openssl s_client -servername gitlab.{LB_IP_ADDR}.nip.io -connect gitlab.{LB_IP_ADDR}.nip.io:443
   ```

   7.2 Create file on your Cloud Shell gitlab.{LB_IP_ADDR}.nip.io.crt and copy certificate (from -----BEGIN CERTIFICATE----- to  -----END CERTIFICATE-----)

```bash
kubectl create ns gitlab-managed-apps
kubectl --namespace gitlab-managed-apps create secret generic gitlabcrt --from-file=gitlab.${LB_IP_ADDR}.nip.io.crt
git clone https://github.com/Ansible-in-DevOps/meetup9.git
cd meetup9/infra
nano values_gl_runner.yaml # Add gitlabUrl and runnerRegistrationToken -> GitLab -> Admin section -> Overview -> Runners
helm upgrade --install gitlab-runner-aido --namespace gitlab-managed-apps -f ./values_gl_runner.yaml gitlab/gitlab-runner --version 0.20.1
```

Check GitLab -> Admin section -> Runners.


## Setup CI/CD pipeline 

1. Create apps repo -> Project **apps** -> Private with README
   
Copy/paste code from Meetup9 https://github.com/Ansible-in-DevOps/meetup9/tree/master). 

Use Web IDE. 

1. **gitlab-ci.yml** and **Dockerfile** to root tree. 
2. Next create app dir and copy/paste **index.js**, **package.json** and **start.sh** there.

## Setup Docker Container Registry 

Check if Docker registry is enabled. https://docs.gitlab.com/ee/user/packages/container_registry/

Next add token for Docker registry. User Settings -> Access Tokens -> Name: docker registry -> api -> copy token and go to the apps project.

In our case docker registry is **gitlab.{LB_IP_ADDR}.nip.io**. Standard https port 443. 

On virtual server/dind and direct docker daemon you have to add **ca.crt** to **/etc/docker/certs.d/**. But we get x509: certificate signed by unknown authority. So only one option is add support for **--insecure-registry**

Vars -> Settings -> CI/CD -> Variables : **REGISTRY_USER**, **REGISTRY_PASSWORD**, **REGISTRY_NAME** as var.

Now create infra repo.

## Setup GCP Container registry

Go to APIs & Services -> Enable Api -> Check if is enabled. 

Go to IAM & Admin and create **service account** with role **Storage Admin**. Next get KEY from service account. 

Add **GCLOUD_SERVICE_KEY** and **GCP_PROJECT_ID** to GitLab Project Vars.
