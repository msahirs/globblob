export class InfoDialog {
  static create(message: string) {
    const dialog = document.createElement('div')
    dialog.classList.add('notification')

    const textPanel = document.createElement('div')
    textPanel.classList.add('notificationText')
    textPanel.innerHTML = message

    const evListener = () => {
      dialog.remove()
      document.body.removeEventListener('click', evListener)
    }

    dialog.appendChild(textPanel)
    document.body.appendChild(dialog)
    window.setTimeout(() => document.body.addEventListener('click', evListener), 50)
  }
}

