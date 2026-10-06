from playwright.sync_api import sync_playwright
import re
U='http://localhost:8765/devispro-ai-v1.html'
errs=[];res=[]
def chk(n,c):res.append(('OK ' if c else 'FAIL ')+n)
def txt(pg,s):return re.sub(r'[\u202f\xa0]',' ',pg.inner_text(s))
with sync_playwright() as p:
    b=p.chromium.launch()
    for vw in ({'width':390,'height':800},{'width':1100,'height':800}):
        ctx=b.new_context(viewport=vw);pg=ctx.new_page();m='mobile' if vw['width']<500 else 'bureau'
        pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.route('**/*',lambda r:r.continue_() if 'localhost' in r.request.url else r.abort())
        pg.goto(U)
        pg.click('nav [data-go=ent]')
        for k,v in {'n':'Plomberie Martin','a':'12 rue des Lilas, 64100 Bayonne','t':'06 12 34 56 78','m':'contact@martin.fr','s':'812 345 678 00019'}.items():pg.fill(f'[data-p={k}]',v)
        pg.click('#psave')
        pg.click('nav [data-go=clients]');pg.fill('#cn','Mme Dupont');pg.fill('#ct','07 11 22 33 44');pg.fill('#cm','dupont@mail.fr');pg.fill('#ca','5 place de la Mairie, Anglet');pg.click('#csave')
        # --- Nouveau devis : infos client + saisie manuelle
        pg.click('nav [data-go=new]')
        chk(m+': champs client visibles',all(pg.is_visible(i) for i in('#cl','#clt','#clm','#cla')))
        pg.fill('#cl','M. Bernard');pg.fill('#clt','06 00 11 22 33');pg.fill('#clm','bernard@mail.fr');pg.fill('#cla','8 rue du Port, Biarritz')
        pg.click('#blank')
        g=lambda k:pg.input_value(f'#paper [data-f={k}]');c=lambda k:pg.input_value(f'#paper [data-c={k}]')
        chk(m+': entreprise reprise (5 infos)',[g('co'),g('adr'),g('tel'),g('mail'),g('si')]==['Plomberie Martin','12 rue des Lilas, 64100 Bayonne','06 12 34 56 78','contact@martin.fr','812 345 678 00019'])
        chk(m+': client repris (4 infos)',[c('n'),c('tel'),c('mail'),c('adr')]==['M. Bernard','06 00 11 22 33','bernard@mail.fr','8 rue du Port, Biarritz'])
        chk(m+': 1 ligne vide créée',pg.locator('#lines .ln').count()==1 and pg.input_value('#lines .d')=='')
        chk(m+': focus sur la désignation',pg.evaluate("document.activeElement.classList.contains('d')"))
        pg.fill('#lines .d >> nth=0','Pose d\'un lavabo');pg.fill('#lines [data-k=q] >> nth=0','2');pg.fill('#lines [data-k=p] >> nth=0','150,50');pg.select_option('#lines [data-k=t] >> nth=0','20')
        chk(m+': total ligne 301,00',('301,00' in txt(pg,'#lt0')))
        pg.click('#add');chk(m+': ajout 2e ligne',pg.locator('#lines .ln').count()==2)
        pg.fill('#lines .d >> nth=1','Main d\'œuvre');pg.fill('#lines [data-k=q] >> nth=1','3');pg.fill('#lines [data-k=p] >> nth=1','55');pg.select_option('#lines [data-k=t] >> nth=1','10')
        T=txt(pg,'#tot')
        chk(m+': total HT 466,00',('Total HT' in T and '466,00' in T))
        chk(m+': TVA 20% = 60,20',bool(re.search(r'TVA 20 %\s*60,20',T)));chk(m+': TVA 10% = 16,50',bool(re.search(r'TVA 10 %\s*16,50',T)))
        chk(m+': TTC 542,70',bool(re.search(r'Total TTC\s*542,70',T)))
        pg.click('#add');pg.click('#lines [data-del="2"]');chk(m+': ajout puis suppression ligne',pg.locator('#lines .ln').count()==2)
        pg.click('#lines [data-del="0"]');T=txt(pg,'#tot')
        chk(m+': suppression 1re ligne recalcule (181,50)',bool(re.search(r'Total TTC\s*181,50',T)))
        pg.click('#blank');chk(m+': 2e clic ne détruit pas le devis',pg.locator('#lines .ln').count()==1 and pg.input_value('#lines .d')=="Main d'œuvre")
        # persistance + liste
        pg.reload();chk(m+': devis manuel conservé après actualisation','M. Bernard' in txt(pg,'#ql') and '181,50' in txt(pg,'#ql'))
        pg.click('#ql [data-act=open]');chk(m+': réouverture: client + ligne',c('tel')=='06 00 11 22 33' and pg.input_value('#lines .d')=="Main d'œuvre")
        # --- client enregistré : liste -> Nouveau devis, et saisie dans le champ
        pg.click('nav [data-go=clients]');pg.click('#cll [data-act=newfor]')
        chk(m+': depuis Mes clients: champs préremplis',pg.input_value('#cl')=='Mme Dupont' and pg.input_value('#clt')=='07 11 22 33 44' and pg.input_value('#cla').startswith('5 place'))
        pg.click('nav [data-go=new]');pg.fill('#cl','mme dupont');pg.press('#cl','Tab')
        chk(m+': saisie du nom: coordonnées complétées',pg.input_value('#clm')=='dupont@mail.fr')
        # --- génération par description (existant) avec infos client
        pg.fill('#txt',"Remplacement du chauffe-eau 200 L à 480 €\n3 h main d'œuvre à 55 €");pg.click('#gen')
        chk(m+': génération par description OK',pg.locator('#lines .ln').count()==2 and c('mail')=='dupont@mail.fr' and '709,50' in txt(pg,'#tot'))
        pg.click('#gen') if pg.is_visible('#gen') else None
        chk(m+': régénération: pas de doublon',len(pg.evaluate("JSON.parse(localStorage.getItem('dpa2')).quotes"))==2)
        pg.click('nav [data-go=new]');pg.click('#gen');chk(m+': description vide -> erreur',pg.inner_text('#err').startswith('Décrivez'))
        pg.click('[data-ex=pein]');pg.click('#gen');chk(m+': exemple + génération',pg.locator('#lines .ln').count()==3)
        chk(m+': PDF/imprimer/supprimer toujours là',all(pg.is_visible(i) for i in('#pdf','#prt','[data-act=del]','#back')))
        chk(m+': pas de défilement horizontal',pg.evaluate("document.documentElement.scrollWidth<=window.innerWidth"))
        if m=='mobile':pg.screenshot(path='/home/claude/mobile.png',full_page=False)
        ctx.close()
    b.close()
print('\n'.join(res));print('ERREURS JS:',errs or 'aucune')
