# AiDO Meetup #9 with Cloud-Native-Kubernetes-Warsaw: Build and manage NodeJS app using GitLab on GKE



### Date: Wednesday, October 14, 2020 5:00 PM to 7:00 PM CET
### Place: online
### Link: https://www.meetup.com/Cloud-Native-Kubernetes-Warsaw/events/273791578/
### Organizer: Cloud-Native-Kubernetes-Warsaw
### Sperakers: Radosław Zduński and Grzegorz Bołtuć from AiDO Meetup

## Useful links

1. https://www.meetup.com/Ansible-in-DevOps-Torun-Bydgoszcz/
2. https://google.qwiklabs.com/ -> Introduction to GitLab on GKE
3. https://cloud.google.com/kubernetes-engine/docs/quickstarts/deploying-a-language-specific-app#node.js_1
4. GitLab runner: https://docs.gitlab.com/runner/


## Preparation

Steps before Meetup on your GCP account.

1. Create a new project, for example: GitLab-AiDO.
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

```bash
echo; kubectl cluster-info | awk '/Kubernetes master/ {print $NF}'; echo #API URL
echo; kubectl get secret $(kubectl get secrets | grep default-token| awk '{print $1}') -o jsonpath="{['data']['ca\.crt']}" | base64 --decode; echo; echo
kubectl create serviceaccount -n default gitlab
kubectl create clusterrolebinding gitlab-cluster-admin --serviceaccount default:gitlab --clusterrole=cluster-admin
echo; kubectl -n default get secret $(kubectl -n default get secrets| awk '/^gitlab-token/ {print $1}') -o jsonpath="{['data']['token']}" | base64 --decode; echo; echo
```

4. Go to Kubernetes section. Next Add existing cluster.
5. Install **Ingress** and **Prometheus** to your GKE. GKE section.
6. Add Base domain GKE information in GitLab (DNS name). GKE section. ->  gitlab.${LB_IP_ADDR}.nip.io
7. Install GitLab Runner using GCP Cloud Shell.

   7.1. Get certificate from your Web page gitlab.${LB_IP_ADDR}.nip.io 
   
   ```bash
   echo | openssl s_client -servername gitlab.${LB_IP_ADDR}.nip.io -connect gitlab.${LB_IP_ADDR}.nip.io:443
   ```

   7.2 Create file on your Cloud Shell gitlab.${LB_IP_ADDR}.nip.io.crt and copy certificate (from -----BEGIN CERTIFICATE----- to  -----END CERTIFICATE-----)

```bash
kubectl create ns gitlab-managed-apps
kubectl --namespace gitlab-managed-apps create secret generic gitlabcrt --from-file=gitlab.${LB_IP_ADDR}.nip.io.crt
git clone https://github.com/Ansible-in-DevOps/meetup9.git
cd meetup9/infra
nano values_gl_runner.yaml # Add gitlabUrl and runnerRegistrationToken -> GitLab -> Admin section -> Overview -> Runners
helm upgrade --install gitlab-runner-aido --namespace gitlab-managed-apps -f ./values_gl_runner.yaml gitlab/gitlab-runner --version 0.20.1
kubectl create ns node
```

Check GitLab -> Admin section -> Runners.

## Setup GCP Container registry

Go to APIs & Services -> Enable Api -> Check if **Google Container Registry API** is enabled. 

Go to IAM & Admin and create **service account** with role **Storage Admin** and **Kubernetes Engine Developer**. Next generate KEY from service account. 

Create apps repo -> Project **apps** -> Private with README

Create infra repo -> Project **infra** -> Private with README

Add **GCLOUD_SERVICE_KEY** (full file, type file) and **GCP_PROJECT_ID** (type vars) to GitLab **app/infra** Project Vars. Settings -> CI/CD -> Vars -> Expand -> Add. 

Add **GKE_CLUSTER_NAME** (type vars) and **GKE_ZONE** (type vars) to GitLab **infra** Project Vars

## Setup CI/CD pipeline app
 
Copy/paste code from Meetup9 https://github.com/Ansible-in-DevOps/meetup9/tree/master). 

Use Web IDE in **apps** Project. 

1. Create file named as **.gitlab-ci.yml** to root tree from https://github.com/Ansible-in-DevOps/meetup9/blob/master/infra/.gitlab-ci-app.yml
2. Create file named as **Dockerfile** to root tree from https://github.com/Ansible-in-DevOps/meetup9/blob/master/Dockerfile
3. Next create app dir and copy/paste **index.js**, **package.json** and **start.sh** there from https://github.com/Ansible-in-DevOps/meetup9/blob/master/app
4. Commit to master. 
5. Check id pipeline finish with success -> app Project -> CI/CD
6. Check GCP Container Registry from Console if a new image **node14v1** is visible. Copy gcr link. 

## Setup CI/CD pipeline infra 

Copy/paste code from Meetup9 https://github.com/Ansible-in-DevOps/meetup9/tree/master). 

Use Web IDE in **infra** Project. 

1. Create file named as **deployment.yaml** to root tree from https://github.com/Ansible-in-DevOps/meetup9/blob/master/infra/deployment.yaml
2. Create file named as **service.yaml** to root tree from https://github.com/Ansible-in-DevOps/meetup9/blob/master/infra/service.yaml
3. Create file named as **.gitlab-ci.yml** to root tree from https://github.com/Ansible-in-DevOps/meetup9/blob/master/infra/.gitlab-ci-infra.yml 
4. Edit deployment, add your name gcr link to your image. 
5. Commit to master. 
6. Check if pipeline finish with success. 
7. Go to Cloud Shell.

```bash
kubectl get pods -n node
kubectl get svc -n node
```

1. Open web browser with **external IP** from service and port **7777**
2. Change number or freplica in deployment from 1 to 5.
3. Check pods and web url again a few times. 



