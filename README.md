# 📚 MaNote - Calculateur de Moyenne L3 Informatique

Application web moderne pour calculer les moyennes des étudiants L3 Informatique S5A.

![Made with ❤️ by aldothedev](https://img.shields.io/badge/Made%20with%20%E2%9D%A4%EF%B8%8F%20by-aldothedev-blue)
![Netlify](https://img.shields.io/badge/Deploy-Netlify-00C7B7?logo=netlify)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Fonctionnalités

- **Calcul automatique** des moyennes par UE, bloc et générale
- **Simulateur** : Quelle note faut-il pour valider ?
- **Scénarios** : Meilleur/Pire cas
- **Import automatique** : Entre ton numéro d'étudiant pour récupérer tes notes
- **Sauvegarde locale** : Tes notes sont conservées dans le navigateur
- **Thème clair/sombre** : Personnalise ton expérience
- **Responsive** : Fonctionne sur mobile, tablette et desktop

---

## 🚀 Déploiement

### Netlify (Recommandé - Gratuit)

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy)

**Résumé rapide :**
1. Push sur GitHub
2. Connecte à Netlify
3. Déploie automatiquement !

---

## 💻 Développement Local

### 1. Cloner le repo
```bash
git clone https://github.com/ton-username/manote.git
cd manote
```

### 2. Ouvrir dans le navigateur

**Option 1 : Double-clic**
Ouvre simplement `index.html` directement dans ton navigateur

**Option 2 : Serveur local** (recommandé pour éviter les problèmes CORS)
```bash
# Avec Python
python -m http.server 8000

# Ou avec PHP
php -S localhost:8000
```

Puis ouvre [http://localhost:8000](http://localhost:8000)

---

## 📁 Structure du Projet

```
manote/
├── index.html                 # Page principale
├── css/
│   └── style.css              # Styles
├── js/
│   ├── app.js                 # Logique principale
│   └── grades-data.js         # Base de données des notes
└── README.md                  # Documentation
```

---

## 🔒 Sécurité

- **LocalStorage** pour sauvegarder les notes localement
- **HTTPS** automatique (Netlify)
- Aucune donnée sensible n'est envoyée au serveur

---

## 🎓 Structure des Notes

### Blocs et Coefficients

| Bloc | UE | Coeff UE | Coeff Bloc |
|------|-----|----------|------------|
| **Graphes et algorithmes** | Graphes et algorithmes | 1 | **6** |
| | Problem solving | 1 | |
| **Mathématiques** | Probabilités | 1 | **6** |
| | Traitement du signal | 1 | |
| **Architecture** | Architecture systèmes | 2 | **9** |
| | Algorithmes réseaux | 1 | |
| **BDD et GL** | Bases de données 2 | 1 | **6** |
| | Génie logiciel | 1 | |

**Coefficient total :** 27

### Validation
- **UE validée** : Moyenne ≥ 10/20
- **Bloc validé** : Moyenne ≥ 10/20
- **Semestre validé** : Moyenne générale ≥ 10/20

---

## 🛠️ Technologies

- HTML5 / CSS3
- JavaScript (Vanilla)
- Netlify (hébergement)

---

## 📝 Utilisation

1. Va sur le site
2. Entre ton numéro d'étudiant (8 chiffres)
3. Clique "Importer" pour récupérer tes notes automatiquement
4. OU entre tes notes manuellement
5. Consulte ta moyenne, simule tes besoins, etc.

---

## 🤝 Contribution

Les contributions sont les bienvenues !

1. Fork le projet
2. Crée une branche (`git checkout -b feature/AmazingFeature`)
3. Commit tes changements (`git commit -m 'Add AmazingFeature'`)
4. Push (`git push origin feature/AmazingFeature`)
5. Ouvre une Pull Request

---

## 📜 License

Ce projet est sous licence MIT. Voir [LICENSE](LICENSE) pour plus d'infos.

---

## 👨‍💻 Auteur

**aldothedev**

- 💼 Projet créé pour faciliter le suivi des notes en L3 Informatique
- ❤️ Made with love and code

---

## 🙏 Remerciements

- Netlify pour l'hébergement gratuit
- Tous les étudiants qui utilisent cette app !

---

**⭐ Si ce projet t'aide, n'hésite pas à lui donner une étoile sur GitHub !**
